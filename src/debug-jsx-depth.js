const fs = require('fs');
const content = fs.readFileSync('d:\\Carpetas\\Desktop\\Zona motores\\web\\Zona-Motores-main\\src\\components\\business\\sale-form-dialog.tsx', 'utf8');

const lines = content.split('\n');
let depth = 0;

lines.forEach((line, i) => {
    const opens = (line.match(/<div/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    if (opens !== closes) {
        depth += (opens - closes);
        console.log(`Line ${i + 1}: Depth ${depth} (+${opens}, -${closes}) | ${line.trim().substring(0, 50)}`);
    }
});
