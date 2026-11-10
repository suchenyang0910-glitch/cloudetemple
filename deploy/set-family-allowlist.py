#!/usr/bin/env python3
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import time


def main():
    source = Path("/tmp/chuamay-family-allowlist.txt")
    target = Path("/etc/chuamay/staging.env")
    emails = [line.strip().lower() for line in source.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
    if len(emails) != 2 or len(set(emails)) != 2 or not all(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) for email in emails):
        raise SystemExit("family allowlist must contain two unique valid emails")

    metadata = target.stat()
    backup = target.with_name(f"staging.env.pre-family-allowlist-{time.strftime('%Y%m%d%H%M%S')}")
    shutil.copy2(target, backup)
    lines = [line for line in target.read_text(encoding="utf-8").splitlines() if not line.startswith(("FAMILY_ENABLED=", "FAMILY_ALLOWLIST="))]
    lines.extend(("FAMILY_ENABLED=1", f"FAMILY_ALLOWLIST={','.join(emails)}"))
    descriptor, temporary = tempfile.mkstemp(prefix=".staging.env.", dir=target.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write("\n".join(lines) + "\n")
        os.chown(temporary, metadata.st_uid, metadata.st_gid)
        os.chmod(temporary, metadata.st_mode & 0o777)
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
        source.unlink(missing_ok=True)
    print(json.dumps({"allowlistEntries": 2, "backup": backup.name, "mode": oct(target.stat().st_mode & 0o777)}))


if __name__ == "__main__":
    main()
