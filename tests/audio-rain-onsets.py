import argparse, array, json, math, statistics, sys, wave
from pathlib import Path


def read_wav(path):
    with wave.open(str(path), 'rb') as wav:
        channels, width, rate, frames = wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getnframes()
        if width != 2:
            raise ValueError('expected 16-bit PCM WAV')
        samples = array.array('h', wav.readframes(frames))
    if sys.byteorder != 'little':
        samples.byteswap()
    mono = [sum(samples[i:i + channels]) / (32768 * channels) for i in range(0, len(samples), channels)]
    return rate, mono


def band_envelope(samples, rate, low=150, high=1200, frame_ms=25):
    hp_decay = math.exp(-2 * math.pi * low / rate)
    lp_decay = math.exp(-2 * math.pi * high / rate)
    previous = hp = lp = 0.0
    filtered = []
    for sample in samples:
        hp = hp_decay * (hp + sample - previous)
        previous = sample
        lp = (1 - lp_decay) * hp + lp_decay * lp
        filtered.append(lp)
    size = max(1, round(rate * frame_ms / 1000))
    envelope = []
    for start in range(0, len(filtered) - size + 1, size):
        rms = math.sqrt(sum(value * value for value in filtered[start:start + size]) / size)
        envelope.append(20 * math.log10(max(rms, 1e-9)))
    return envelope, size / rate


def detect_onsets(envelope, step, threshold=8):
    cooldown = max(1, round(0.75 / step))
    baseline = statistics.quantiles(envelope, n=10)[2]
    candidates = []
    for index in range(2, len(envelope) - 2):
        if envelope[index] < max(envelope[index - 2:index + 3]):
            continue
        delta = envelope[index] - baseline
        if delta >= threshold:
            candidates.append((index, delta, envelope[index], baseline))
    onsets = []
    for candidate in candidates:
        if onsets and candidate[0] - onsets[-1][0] < cooldown:
            if candidate[1] > onsets[-1][1]:
                onsets[-1] = candidate
        else:
            onsets.append(candidate)
    return [{'time': round(index * step, 3), 'aboveBaselineDb': round(delta, 2), 'peakDbfs': round(peak, 2), 'baselineDbfs': round(base, 2)} for index, delta, peak, base in onsets]


def rms_db(samples):
    rms = math.sqrt(sum(value * value for value in samples) / max(1, len(samples)))
    return 20 * math.log10(max(rms, 1e-9))


parser = argparse.ArgumentParser(description='Verify audible generated plucks in a 30-second rain-and-strings WAV.')
parser.add_argument('wav', type=Path)
parser.add_argument('--rain', type=Path)
args = parser.parse_args()
rate, samples = read_wav(args.wav)
envelope, step = band_envelope(samples, rate)
onsets = detect_onsets(envelope, step)
intervals = [round(onsets[i]['time'] - onsets[i - 1]['time'], 3) for i in range(1, len(onsets))]
overall = rms_db(samples)
result = {
    'file': str(args.wav),
    'durationSeconds': round(len(samples) / rate, 3),
    'bandHz': [150, 1200],
    'onsetCount': len(onsets),
    'onsets': onsets,
    'intervalsSeconds': intervals,
    'intervalsVary': len({round(value, 1) for value in intervals}) > 1,
    'overallRmsDbfs': round(overall, 2),
    'nearLimiterPercent': round(100 * sum(abs(value) >= 10 ** (-6.5 / 20) for value in samples) / max(1, len(samples)), 5),
}
if args.rain:
    rain_rate, rain_samples = read_wav(args.rain)
    if rain_rate != rate:
        raise ValueError('reference rain WAV sample rate differs')
    rain_envelope, rain_step = band_envelope(rain_samples, rain_rate)
    result['rainReferenceOnsetCount'] = len(detect_onsets(rain_envelope, rain_step))
result['passed'] = len(onsets) >= 6 and all(item['aboveBaselineDb'] >= 8 for item in onsets) and result['intervalsVary'] and overall <= -26 and result['nearLimiterPercent'] < 0.1
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if result['passed'] else 1)
