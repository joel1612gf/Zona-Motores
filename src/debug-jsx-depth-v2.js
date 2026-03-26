const fs = require('fs');
const content = fs.readFileSync('d:\\Carpetas\\Desktop\\Zona motores\\web\\Zona-Motores-main\\src\\components\\business\\sale-form-dialog.tsx', 'utf8');

const lines = content.split('\n');
let depth = 0;

lines.forEach((line, i) => {
    // Count opening tags that are NOT self-closing
    // This is hard with regex, so we count all <div and then subtract self-closing ones
    const allOpens = (line.match(/<div/g) || []).length;
    const selfCloses = (line.match(/<div[^>]*\/>/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    
    const opens = allOpens - selfCloses;
    depth += (opens - closes);
    
    if (i + 1 >= 250) {
        console.log(`L${i + 1} [D:${depth}]: ${line.trim().substring(0, 50)}`);
    }
});
