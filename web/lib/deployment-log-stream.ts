export type DeploymentLogMessage = { stream: string; text: string };

export async function streamDeploymentLogs(
  url: string,
  token: string,
  onMessage: (message: DeploymentLogMessage) => void,
  signal: AbortSignal,
) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error('Could not connect to deployment logs');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const event = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (data) {
        try {
          onMessage(JSON.parse(data) as DeploymentLogMessage);
        } catch {
          // Ignore malformed or non-JSON heartbeat events.
        }
      }
      boundary = buffer.indexOf('\n\n');
    }
  }
}
