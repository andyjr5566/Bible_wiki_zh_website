"""Send a Python file to the Blender MCP addon socket (port 9876) and print the result.

usage: python send.py <script.py>
"""
import json, socket, sys

code = open(sys.argv[1], encoding="utf-8").read()
s = socket.socket(); s.settimeout(300)
s.connect(("127.0.0.1", 9876))
s.sendall(json.dumps({"type": "execute_code", "params": {"code": code}}).encode("utf-8"))
buf = b""
while True:
    chunk = s.recv(65536)
    if not chunk:
        break
    buf += chunk
    try:
        json.loads(buf.decode("utf-8")); break
    except ValueError:
        continue
print(buf.decode("utf-8")[:4000])
