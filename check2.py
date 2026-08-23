
import urllib.request
import json
import time

url = 'https://api.github.com/repos/andyjr5566/Bible_wiki_zh_website/actions/runs?per_page=1'
req = urllib.request.Request(url)
req.add_header('Accept', 'application/vnd.github.v3+json')
req.add_header('Cache-Control', 'no-cache')
while True:
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if data['workflow_runs']:
                run = data['workflow_runs'][0]
                status = run['status']
                conclusion = run['conclusion']
                message = run['head_commit']['message']
                if message == 'fix: add missing content public assets':
                    print(f'Status: {status}, Conclusion: {conclusion}', flush=True)
                    if status == 'completed':
                        break
    except Exception as e:
        print(e, flush=True)
    time.sleep(10)

