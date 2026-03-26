const fs = require('fs');
const content = fs.readFileSync('d:\\Carpetas\\Desktop\\Zona motores\\web\\Zona-Motores-main\\src\\components\\business\\sale-form-dialog.tsx', 'utf8');

const lines = content.split('\n');
let depth = 0;

console.log('--- START ---');
lines.forEach((line, i) => {
    const opens = (line.match(/<div/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    depth += (opens - closes);
    if (i + 1 >= 250) {
        console.log(`L${i + 1} [D:${depth}]: ${line.trim().substring(0, 60)}`);
    }
});
