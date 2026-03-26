const fs = require('fs');

const content = fs.readFileSync('d:\\Carpetas\\Desktop\\Zona motores\\web\\Zona-Motores-main\\src\\components\\business\\sale-form-dialog.tsx', 'utf8');

function count(pattern) {
    const matches = content.match(pattern);
    return matches ? matches.length : 0;
}

console.log('Open divs:', count(/<div/g));
console.log('Close divs:', count(/<\/div>/g));
console.log('Open braces (jsx):', count(/\{/g));
console.log('Close braces (jsx):', count(/\}/g));
console.log('Open parens in jsx:', count(/\{.*?\(/g));
console.log('Close parens in jsx:', count(/\)\}/g));
