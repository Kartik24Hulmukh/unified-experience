import fs from 'fs';
let content = fs.readFileSync('HospitalPage.tsx', 'utf8');
content = content.replace(/const hospitals = \[([\s\S]*?)\];/, (match) => {
  return match.replace(/services: \[.*?\](,?)/g, (m) => m + \,\n    image: '/Hospital.png'\);
});
content = content.replace(/const filteredItems = useMemo\(\(\) => \{([\s\S]*?)return listItems\.filter\(/, (match, p1) => {
  return \const filteredItems = useMemo(() => {
    const listItems = [...hospitals.map(h => ({...h})), ...visibleItems.map((h) => ({
      id: h.id,
      title: h.title,
      price: h.price,
      category: h.category,
      institution: h.institution,
    }))];
    return listItems.filter(\;
});
fs.writeFileSync('HospitalPage.tsx', content);
console.log('Done HospitalPage');
