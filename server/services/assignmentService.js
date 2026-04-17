const departmentMapping = {
  'Garbage': 'Sanitation',
  'Water': 'Water Supply',
  'Electricity': 'Electric Board',
  'Road': 'Public Works',
  'Safety': 'Police',
  'Other': 'General'
};

const assignDepartment = (category, originalText = '') => {
  // Normalize AI category if it exists
  const cat = category || 'Other';
  const normalized = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
  
  if (departmentMapping[normalized] && normalized !== 'Other') {
    return departmentMapping[normalized];
  }

  // Final fallback based on keywords in the original text or category
  const searchSpace = `${cat} ${originalText}`.toLowerCase();
  
  if (searchSpace.includes('water') || searchSpace.includes('leak') || searchSpace.includes('pipe') || searchSpace.includes('flood') || searchSpace.includes('supply')) {
    return 'Water Supply';
  }
  
  if (searchSpace.includes('trash') || searchSpace.includes('garbage') || searchSpace.includes('sanitation') || searchSpace.includes('waste')) {
    return 'Sanitation';
  }
  
  if (searchSpace.includes('light') || searchSpace.includes('power') || searchSpace.includes('electric') || searchSpace.includes('spark') || searchSpace.includes('transformer')) {
    return 'Electric Board';
  }
  
  if (searchSpace.includes('road') || searchSpace.includes('pothole') || searchSpace.includes('pavement') || searchSpace.includes('traffic')) {
    return 'Public Works';
  }
  
  if (searchSpace.includes('safety') || searchSpace.includes('harass') || searchSpace.includes('theft') || searchSpace.includes('police') || searchSpace.includes('security')) {
    return 'Police';
  }

  return 'General';
};

module.exports = { assignDepartment };
