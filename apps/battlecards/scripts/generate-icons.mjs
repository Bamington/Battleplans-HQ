/**
 * Solar Icon Generator
 * Downloads SVGs from the Solar Icon Set GitHub repo and creates React TSX components.
 * Run with: node scripts/generate-icons.mjs
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE_URL = 'https://raw.githubusercontent.com/480-Design/Solar-Icon-Set/main/icons/SVG';
const LINEAR_DIR = path.join(ROOT, 'src', 'icons');
const BOLD_DIR = path.join(ROOT, 'src', 'icons', 'bold');

fs.mkdirSync(LINEAR_DIR, { recursive: true });
fs.mkdirSync(BOLD_DIR, { recursive: true });

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(data);
        else reject(new Error(`HTTP ${res.statusCode}`));
      });
    }).on('error', reject);
  });
}

function svgToComponent(svg, componentName) {
  // Extract inner SVG content
  const innerMatch = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!innerMatch) throw new Error('No SVG content found');

  let inner = innerMatch[1].trim();
  inner = inner
    .replace(/stroke="black"/g, 'stroke="currentColor"')
    .replace(/fill="black"/g, 'fill="currentColor"');

  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';

  return `interface Props {
  className?: string;
}

const ${componentName} = ({ className }: Props) => (
  <svg
    viewBox="${viewBox}"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    ${inner}
  </svg>
);

export default ${componentName};
`;
}

const ICONS = [
  // ─── Component icons ──────────────────────────────────────────────────────
  { name: 'HamburgerMenu',      category: 'Essentional, UI',       file: 'Hamburger Menu' },
  { name: 'CloseCircle',        category: 'Essentional, UI',       file: 'Close Circle' },
  { name: 'AltArrowDown',       category: 'Arrows',                file: 'Alt Arrow Down' },
  { name: 'AltArrowUp',         category: 'Arrows',                file: 'Alt Arrow Up' },
  { name: 'AltArrowLeft',       category: 'Arrows',                file: 'Alt Arrow Left' },
  { name: 'AltArrowRight',      category: 'Arrows',                file: 'Alt Arrow Right' },
  { name: 'AddCircle',          category: 'Essentional, UI',       file: 'Add Circle' },
  { name: 'MinusCircle',        category: 'Essentional, UI',       file: 'Minus Circle' },
  { name: 'CheckCircle',        category: 'Essentional, UI',       file: 'Check Circle' },
  { name: 'DangerCircle',       category: 'Essentional, UI',       file: 'Danger Circle' },

  // ─── Gallery icons ────────────────────────────────────────────────────────
  { name: 'Home',               category: 'Essentional, UI',       file: 'Home' },
  { name: 'Magnifer',           category: 'Search',                file: 'Magnifer' },
  { name: 'Bell',               category: 'Notifications',         file: 'Bell' },
  { name: 'BellBing',           category: 'Notifications',         file: 'Bell Bing' },
  { name: 'Settings',           category: 'Settings, Fine Tuning', file: 'Settings' },
  { name: 'Star',               category: 'Like',                  file: 'Star' },
  { name: 'Bookmark',           category: 'School',                file: 'Bookmark' },
  { name: 'TrashBinMinimalistic', category: 'Essentional, UI',     file: 'Trash Bin Minimalistic' },
  { name: 'DownloadMinimalistic', category: 'Arrows Action',       file: 'Download Minimalistic' },
  { name: 'UploadMinimalistic',   category: 'Arrows Action',       file: 'Upload Minimalistic' },
  { name: 'Diskette',           category: 'Electronic, Devices',   file: 'Diskette' },
  { name: 'Share',              category: 'Essentional, UI',       file: 'Share' },
  { name: 'Filter',             category: 'Essentional, UI',       file: 'Filter' },
  { name: 'MenuDots',           category: 'Essentional, UI',       file: 'Menu Dots' },
  { name: 'Eye',                category: 'Security',              file: 'Eye' },
  { name: 'EyeClosed',          category: 'Security',              file: 'Eye Closed' },
  { name: 'Lock',               category: 'Security',              file: 'Lock' },
  { name: 'LockUnlocked',       category: 'Security',              file: 'Lock Unlocked' },
  { name: 'InfoCircle',         category: 'Essentional, UI',       file: 'Info Circle' },
  { name: 'QuestionCircle',     category: 'Essentional, UI',       file: 'Question Circle' },
  { name: 'ArrowLeft',          category: 'Arrows',                file: 'Arrow Left' },
  { name: 'ArrowRight',         category: 'Arrows',                file: 'Arrow Right' },
  { name: 'ArrowUp',            category: 'Arrows',                file: 'Arrow Up' },
  { name: 'ArrowDown',          category: 'Arrows',                file: 'Arrow Down' },
  { name: 'UserRounded',        category: 'Users',                 file: 'User Rounded' },
  { name: 'UsersGroupRounded',  category: 'Users',                 file: 'Users Group Rounded' },
  { name: 'UserPlusRounded',    category: 'Users',                 file: 'User Plus Rounded' },
  { name: 'UserCircle',         category: 'Users',                 file: 'User Circle' },
  { name: 'Widget2',            category: 'Settings, Fine Tuning', file: 'Widget 2' },
  { name: 'Inbox',              category: 'Messages, Conversation',file: 'Inbox' },
  { name: 'Letter',             category: 'Messages, Conversation',file: 'Letter' },
  { name: 'Gallery',            category: 'Video, Audio, Sound',   file: 'Gallery' },
  { name: 'FileText',           category: 'Files',                 file: 'File Text' },
  { name: 'Folder',             category: 'Folders',               file: 'Folder' },
  { name: 'Clipboard',          category: 'Notes',                 file: 'Clipboard' },
  { name: 'Play',               category: 'Video, Audio, Sound',   file: 'Play' },
  { name: 'Pause',              category: 'Video, Audio, Sound',   file: 'Pause' },
  { name: 'Stop',               category: 'Video, Audio, Sound',   file: 'Stop' },
  { name: 'Microphone',         category: 'Video, Audio, Sound',   file: 'Microphone' },
  { name: 'Videocamera',        category: 'Video, Audio, Sound',   file: 'Videocamera' },
  { name: 'Moon',               category: 'Weather',               file: 'Moon' },
  { name: 'Sun',                category: 'Weather',               file: 'Sun' },
  { name: 'Rocket',             category: 'Astronomy',             file: 'Rocket' },
  { name: 'Shield',             category: 'Security',              file: 'Shield' },
  { name: 'Flag',               category: 'Essentional, UI',       file: 'Flag' },
  { name: 'Heart',              category: 'Like',                  file: 'Heart' },
  { name: 'Pen2',               category: 'Messages, Conversation',file: 'Pen 2' },
  { name: 'ListCheck',          category: 'List',                  file: 'List Check' },
];

async function processIcon(style, icon, outDir) {
  const url = `${BASE_URL}/${encodeURIComponent(style)}/${encodeURIComponent(icon.category)}/${encodeURIComponent(icon.file)}.svg`;
  const svg = await fetchUrl(url);
  const componentName = style === 'Bold' ? `${icon.name}Bold` : icon.name;
  const tsx = svgToComponent(svg, componentName);
  fs.writeFileSync(path.join(outDir, `${icon.name}.tsx`), tsx);
}

async function main() {
  const success = [];
  const failed = [];

  // Linear icons
  for (const icon of ICONS) {
    try {
      await processIcon('Linear', icon, LINEAR_DIR);
      success.push(`Linear/${icon.name}`);
      process.stdout.write(`✓ Linear/${icon.name}\n`);
    } catch (e) {
      failed.push(`Linear/${icon.name}: ${e.message}`);
      process.stdout.write(`✗ Linear/${icon.name}: ${e.message}\n`);
    }
  }

  // Bold icons
  for (const icon of ICONS) {
    try {
      await processIcon('Bold', icon, BOLD_DIR);
      success.push(`Bold/${icon.name}`);
      process.stdout.write(`✓ Bold/${icon.name}\n`);
    } catch (e) {
      failed.push(`Bold/${icon.name}: ${e.message}`);
      process.stdout.write(`✗ Bold/${icon.name}: ${e.message}\n`);
    }
  }

  console.log(`\n✅ Success: ${success.length}  ❌ Failed: ${failed.length}`);
  if (failed.length) {
    console.log('\nFailed:\n' + failed.join('\n'));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
