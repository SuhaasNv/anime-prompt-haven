import prompt1 from "@/assets/prompt-1.jpg";
import prompt2 from "@/assets/prompt-2.jpg";
import prompt3 from "@/assets/prompt-3.jpg";
import prompt4 from "@/assets/prompt-4.jpg";
import prompt5 from "@/assets/prompt-5.jpg";
import prompt6 from "@/assets/prompt-6.jpg";

export type Prompt = {
  id: string;
  title: string;
  description: string;
  body: string;
  image: string;
  creator: string;
  creatorEmoji: string;
  price: number; // 0 = free
  rating: number;
  reviews: number;
  category: string;
  model: "Midjourney" | "ChatGPT" | "DALL-E" | "Flux" | "Stable Diffusion";
  tags: string[];
  shadow: "magenta" | "orange" | "yellow" | "purple" | "black";
  rotate?: 1 | -1 | 0;
};

export const PROMPTS: Prompt[] = [
  {
    id: "prism-heart",
    title: "Prism Heart Overload",
    description: "Magical girl transformation sequences with holographic light and sparkle bloom.",
    body: "ultra-detailed magical girl mid-transformation, holographic ribbons, magenta and gold light bloom, cel-shaded anime, dramatic rim lighting, cinematic --ar 3:4 --style raw",
    image: prompt1,
    creator: "Luna_99",
    creatorEmoji: "🌙",
    price: 12,
    rating: 4.9,
    reviews: 128,
    category: "Image Generation",
    model: "Midjourney",
    tags: ["#MAGICAL-GIRL", "#HOLO", "#CINEMATIC"],
    shadow: "purple",
    rotate: 0,
  },
  {
    id: "neo-shinjuku",
    title: "Neo-Shinjuku Core",
    description: "Rainy cyberpunk back-alleys with dense neon kanji signage and chrome reflections.",
    body: "rain-soaked Neo-Tokyo alleyway, dense neon kanji signage, cyberpunk anime, chrome reflections, deep purples and orange neon, 35mm cinematic --ar 4:3",
    image: prompt2,
    creator: "Unit-01",
    creatorEmoji: "🤖",
    price: 8,
    rating: 5.0,
    reviews: 82,
    category: "Image Generation",
    model: "Flux",
    tags: ["#CYBERPUNK", "#NEON", "#URBAN"],
    shadow: "orange",
    rotate: 1,
  },
  {
    id: "holo-vocaloid",
    title: "Holo-Vocaloid Stage",
    description: "Idol concert with volumetric stage lights and a glittering holographic performer.",
    body: "anime idol concert, holographic singer on stage, volumetric stage lights in magenta and yellow, sea of glowsticks, dynamic perspective, ultra-detailed",
    image: prompt3,
    creator: "Miku_Fan",
    creatorEmoji: "💖",
    price: 15,
    rating: 4.8,
    reviews: 211,
    category: "Image Generation",
    model: "Midjourney",
    tags: ["#IDOL", "#STAGE", "#HOLO"],
    shadow: "magenta",
    rotate: -1,
  },
  {
    id: "ova-nostalgia",
    title: "90s OVA Nostalgia",
    description: "Vintage 90s OVA color grading, soft film grain, palm trees, sunset orange skies.",
    body: "90s anime OVA still, sunset beach, soft cel-shading, warm orange palette, slight VHS grain, nostalgic, hand-painted backgrounds",
    image: prompt4,
    creator: "VHS_Lord",
    creatorEmoji: "📼",
    price: 0,
    rating: 4.7,
    reviews: 56,
    category: "Image Generation",
    model: "Stable Diffusion",
    tags: ["#RETRO", "#90s", "#SUNSET"],
    shadow: "yellow",
    rotate: 0,
  },
  {
    id: "sky-castle",
    title: "Sky Castle Saga",
    description: "Floating islands at golden hour, dramatic clouds, epic anime fantasy worldbuilding.",
    body: "floating sky islands at sunset, dramatic orange clouds, anime fantasy castle silhouette, epic scale, painterly, Ghibli-inspired composition",
    image: prompt5,
    creator: "Cloud_Sage",
    creatorEmoji: "☁️",
    price: 6,
    rating: 4.9,
    reviews: 94,
    category: "Image Generation",
    model: "Midjourney",
    tags: ["#FANTASY", "#SKY", "#EPIC"],
    shadow: "orange",
    rotate: 1,
  },
  {
    id: "dark-academia",
    title: "Forbidden Grimoire",
    description: "Gothic anime library scenes, candle glow, magenta book magic, dark academia mood.",
    body: "gothic anime library at midnight, glowing magenta grimoire, candlelight, dramatic shadows, dark academia, intricate detail",
    image: prompt6,
    creator: "Inkwell",
    creatorEmoji: "🕯️",
    price: 9,
    rating: 4.8,
    reviews: 73,
    category: "Image Generation",
    model: "Flux",
    tags: ["#DARK-ACADEMIA", "#GOTHIC", "#MAGIC"],
    shadow: "magenta",
    rotate: -1,
  },
];

export const CATEGORIES = [
  "All",
  "Image Generation",
  "Content Writing",
  "Coding",
  "Marketing",
  "Roleplay",
];

export const MODELS = ["Midjourney", "ChatGPT", "DALL-E", "Flux", "Stable Diffusion"];

export const TAGS = ["#CYBERPUNK", "#MECHA", "#MAGICAL-GIRL", "#RETRO", "#FANTASY", "#HOLO", "#IDOL"];

export type Collection = {
  id: string;
  name: string;
  vibe: string;
  color: "magenta" | "orange" | "yellow" | "purple";
  progress: number; // 0-100
  promptIds: string[];
};

export const COLLECTIONS: Collection[] = [
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    vibe: "Neon nights, chrome dreams",
    color: "magenta",
    progress: 66,
    promptIds: ["neo-shinjuku", "holo-vocaloid", "dark-academia"],
  },
  {
    id: "lofi-fantasy",
    name: "Lofi Fantasy",
    vibe: "Sky islands and soft magic",
    color: "yellow",
    progress: 33,
    promptIds: ["sky-castle", "ova-nostalgia"],
  },
  {
    id: "mech-archive",
    name: "Mech Archive",
    vibe: "Steel-wing battle ops",
    color: "orange",
    progress: 80,
    promptIds: ["neo-shinjuku", "prism-heart", "sky-castle", "holo-vocaloid"],
  },
];

export const getPrompt = (id: string) => PROMPTS.find((p) => p.id === id);
export const getCollection = (id: string) => COLLECTIONS.find((c) => c.id === id);

export const MASCOT_TIPS: Record<string, string> = {
  "/": "Psst! That Neo-Shinjuku prompt is trending. Grab it before it goes premium!",
  "/dashboard": "Your Mech Archive is looking stacked! Add a new collection to keep building.",
  "/auth": "Welcome back, Senpai. Let's get you signed in!",
  "/profile": "Customize away! Your vibe, your rules.",
  default: "Found any inspiration today, Senpai? ✨",
};
