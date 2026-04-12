import { linkinator } from 'linkinator';

const url = process.argv[2] || 'https://slotsmathguide.ca';
const checker = new linkinator();

const result = await checker.check({
  path: url,
  recurse: true,
  timeout: 15000,
  concurrency: 40,
  linksToSkip: [/^mailto:/, /^tel:/, /github\.com/],
  retry: true,
});

const broken = result.links.filter(l => l.state === 'BROKEN');
console.log(`Checked: ${result.links.length} links`);
console.log(`Broken: ${broken.length}`);
for (const b of broken.slice(0, 50)) {
  console.log(`- ${b.url} (from ${b.parent}) -> ${b.status}`);
}
process.exit(broken.length ? 1 : 0);
