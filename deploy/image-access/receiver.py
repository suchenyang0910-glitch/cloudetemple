"""Private Unix datagrams from the two Cloud Temple nginx sites only."""
import json
import os
import socket
from pathlib import Path

address = Path('/opt/chuamay/nginx-production/sites/.ct-access.sock')
log = Path('/var/log/chuamay-web/access.log')
address.unlink(missing_ok=True)
sock = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
sock.bind(str(address))
os.chmod(address, 0o622)
while True:
    packet = sock.recv(8192)
    try:
        row = json.loads(packet.split(b'ctweb: ', 1)[1])
        if set(row) != {'time','path','status','bytes','seconds','ua','ip'} or '?' in row['path'] or len(row['ua']) > 80:
            continue
        if row['ip'] != '-' and row['ip'].count('.') + row['ip'].count(':') != 1:
            continue
    except (IndexError, ValueError, TypeError, KeyError):
        continue
    # Reopen for each line so daily rotation needs no restart signal.
    with log.open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(row, ensure_ascii=True, separators=(',', ':')) + '\n')
