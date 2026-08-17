const SKILL_CATEGORIES = [
  {id:'cooking', label:'Cooking', icon:'🍳', color:'#ef4444'},
  {id:'technology', label:'Technology', icon:'💻', color:'#3b82f6'},
  {id:'art', label:'Art & Crafts', icon:'🎨', color:'#8b5cf6'},
  {id:'music', label:'Music', icon:'🎵', color:'#f59e0b'},
  {id:'sports', label:'Sports', icon:'⚽', color:'#10b981'},
  {id:'languages', label:'Languages', icon:'🌍', color:'#06b6d4'},
  {id:'fitness', label:'Fitness', icon:'💪', color:'#ec4899'},
  {id:'photography', label:'Photography', icon:'📸', color:'#6366f1'},
  {id:'gardening', label:'Gardening', icon:'🌱', color:'#22c55e'},
  {id:'finance', label:'Finance', icon:'💰', color:'#f59e0b'},
  {id:'writing', label:'Writing', icon:'✍️', color:'#a855f7'},
  {id:'diy', label:'DIY & Home', icon:'🔨', color:'#f97316'},
  {id:'dance', label:'Dance', icon:'💃', color:'#e11d48'},
  {id:'mindfulness', label:'Mindfulness', icon:'🧘', color:'#0ea5e9'},
  {id:'design', label:'Design', icon:'✏️', color:'#7c3aed'},
];

function getCategoryInfo(id) { return SKILL_CATEGORIES.find(c => c.id === id) || { label: id, icon: '📚', color: '#6366f1' }; }
