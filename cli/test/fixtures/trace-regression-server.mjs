import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 43189);

function page(title, extra = '') {
  return `<!doctype html>
<meta charset="utf-8">
<style>
  body { font-family: system-ui; margin: 0; }
  .hero { background: #eef; font-size: 64px; min-height: 420px; padding: 96px; }
</style>
<main><h1 class="hero">${title}</h1></main>
${extra}`;
}

const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');

  if (request.url === '/document-delay') {
    setTimeout(() => {
      response.setHeader('Content-Type', 'text/html');
      response.end(page('Delayed document'));
    }, 800);
    return;
  }

  response.setHeader('Content-Type', 'text/html');
  if (request.url === '/render-delay') {
    response.end(
      page(
        'Delayed render',
        `<style>.hero { opacity: 0; }</style>
<script>
  setTimeout(() => {
    document.querySelector('.hero').style.opacity = '1';
  }, 800);
</script>`
      )
    );
    return;
  }

  response.end(page('Control'));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Trace regression fixtures: http://127.0.0.1:${port}`);
});
