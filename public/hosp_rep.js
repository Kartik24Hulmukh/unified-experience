const fs = require('fs');
let code = fs.readFileSync('c:/Users/SANDIP/Desktop/Unified-Experience/unified-experience/src/pages/HospitalPage.tsx', 'utf8');

const newHospitals = \const hospitals = [
  { id: 'hp1', title: 'Thunga STH Hospital', price: '500', category: 'Hospital', institution: 'Premium', distance: '500m' },
  { id: 'hp2', title: 'Bhartiya Arogya Nidhi', price: '300', category: 'Hospital', institution: 'Premium', distance: '2km' },
  { id: 'hp3', title: 'Bellevue Multidisciplinary', price: '400', category: 'Hospital', institution: 'General', distance: '2km' },
  { id: 'hp4', title: 'BSES MG Hospital', price: '200', category: 'Hospital', institution: 'General', distance: '2.9km' },
  { id: 'hp5', title: 'Dr. R.N. Cooper Hospital', price: '0', category: 'Hospital', institution: 'Public', distance: '3.0km' }
];\;

code = code.replace(/const hospitals = \[([\s\S]*?)\];/g, newHospitals);
fs.writeFileSync('c:/Users/SANDIP/Desktop/Unified-Experience/unified-experience/src/pages/HospitalPage.tsx', code);

