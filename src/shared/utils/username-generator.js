const { v4: uuidv4 } = require('uuid');

const adjectives = [
  'Awesome', 'Brilliant', 'Creative', 'Dynamic', 'Epic', 'Fantastic', 'Great', 'Happy',
  'Incredible', 'Jovial', 'Keen', 'Legendary', 'Magnificent', 'Noble', 'Outstanding',
  'Perfect', 'Quick', 'Radiant', 'Super', 'Tremendous', 'Ultimate', 'Vibrant',
  'Wonderful', 'eXcellent', 'Young', 'Zealous'
];

const nouns = [
  'Artist', 'Builder', 'Creator', 'Designer', 'Explorer', 'Finder', 'Guardian', 'Hero',
  'Innovator', 'Journey', 'Knight', 'Leader', 'Master', 'Navigator', 'Observer', 'Painter',
  'Quest', 'Runner', 'Seeker', 'Traveler', 'User', 'Voyager', 'Wanderer', 'eXpert',
  'Yearner', 'Zealot'
];

const generateRandomUsername = () => {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNum = Math.floor(Math.random() * 9999) + 1;
  
  return `${adjective}${noun}${randomNum}`;
};

const generateUniqueUsername = async (checkUsernameExists) => {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const username = generateRandomUsername();
    const exists = await checkUsernameExists(username);
    
    if (!exists) {
      return username;
    }
    
    attempts++;
  }
  
  // Fallback: usar UUID truncado se não conseguir gerar username único
  const fallbackUsername = `User${uuidv4().substring(0, 8)}`;
  return fallbackUsername;
};

module.exports = {
  generateRandomUsername,
  generateUniqueUsername
};