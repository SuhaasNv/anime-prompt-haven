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
  creatorAvatarUrl?: string | null;
  userId?: string;
  status?: string;
  viewCount?: number;
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
    description: "Magical-girl anime illustration with holographic light blooms and sparkle effects — peak shoujo energy.",
    body: "ultra-detailed magical girl mid-transformation, holographic ribbons, magenta and gold light bloom, cel-shaded anime illustration, dramatic rim lighting, cinematic --ar 3:4 --style raw",
    image: prompt1,
    creator: "Luna_99",
    creatorEmoji: "🌙",
    price: 12,
    rating: 4.9,
    reviews: 128,
    category: "Image Generation",
    model: "Midjourney",
    tags: ["#ANIME", "#ILLUSTRATION", "#HOLO"],
    shadow: "purple",
    rotate: 0,
  },
  {
    id: "neo-shinjuku",
    title: "Neo-Shinjuku Core",
    description: "Rain-soaked cyberpunk streets with dense neon signage, chrome reflections, and cinematic atmosphere.",
    body: "rain-soaked neon-lit city alleyway at night, dense illuminated signage, cyberpunk photography, chrome reflections on wet pavement, deep purples and orange neon, 35mm cinematic lens --ar 4:3",
    image: prompt2,
    creator: "Unit-01",
    creatorEmoji: "🤖",
    price: 8,
    rating: 5.0,
    reviews: 82,
    category: "Image Generation",
    model: "Flux",
    tags: ["#CYBERPUNK", "#PHOTOREAL", "#NEON"],
    shadow: "orange",
    rotate: 1,
  },
  {
    id: "holo-vocaloid",
    title: "Neon Stage Lights",
    description: "Live concert photography with volumetric stage lighting and an electric crowd atmosphere.",
    body: "live concert performance photography, performer under volumetric stage lights in magenta and gold, sea of raised hands, dynamic low-angle perspective, ultra-detailed, cinematic",
    image: prompt3,
    creator: "Miku_Fan",
    creatorEmoji: "💖",
    price: 15,
    rating: 4.8,
    reviews: 211,
    category: "Image Generation",
    model: "Midjourney",
    tags: ["#PHOTOREAL", "#PORTRAIT", "#STAGE"],
    shadow: "magenta",
    rotate: -1,
  },
  {
    id: "ova-nostalgia",
    title: "Retro Sunset Wave",
    description: "Vintage travel-poster illustration with warm gradient skies, soft grain, and laid-back retro vibes.",
    body: "retro travel poster illustration, sunset beach with palm trees, warm gradient sky, soft halftone grain, vaporwave color palette, nostalgic hand-drawn style",
    image: prompt4,
    creator: "VHS_Lord",
    creatorEmoji: "📼",
    price: 0,
    rating: 4.7,
    reviews: 56,
    category: "Image Generation",
    model: "Stable Diffusion",
    tags: ["#RETRO", "#ILLUSTRATION", "#CONCEPT-ART"],
    shadow: "yellow",
    rotate: 0,
  },
  {
    id: "sky-castle",
    title: "Sky Castle Saga",
    description: "Floating islands at golden hour with dramatic clouds — epic painterly fantasy worldbuilding.",
    body: "floating sky islands at sunset, dramatic orange clouds, fantasy castle silhouettes, epic scale, painterly digital concept art, atmospheric lighting",
    image: prompt5,
    creator: "Cloud_Sage",
    creatorEmoji: "☁️",
    price: 6,
    rating: 4.9,
    reviews: 94,
    category: "Image Generation",
    model: "Midjourney",
    tags: ["#FANTASY", "#CONCEPT-ART", "#PAINTERLY"],
    shadow: "orange",
    rotate: 1,
  },
  {
    id: "dark-academia",
    title: "Forbidden Grimoire",
    description: "Gothic library scenes with candle glow and dramatic shadows — moody dark-academia atmosphere.",
    body: "gothic library at midnight, glowing grimoire on a wooden desk, candlelight, dramatic shadows, dark academia aesthetic, intricate architectural detail, cinematic",
    image: prompt6,
    creator: "Inkwell",
    creatorEmoji: "🕯️",
    price: 9,
    rating: 4.8,
    reviews: 73,
    category: "Image Generation",
    model: "Flux",
    tags: ["#GOTHIC", "#CONCEPT-ART", "#FANTASY"],
    shadow: "magenta",
    rotate: -1,
  },
];

export const CATEGORIES = [
  "All",
  "Image Generation",
];

export const MODELS = ["Midjourney", "ChatGPT", "DALL-E", "Flux", "Stable Diffusion"];

export const TAGS = ["#PHOTOREAL", "#CYBERPUNK", "#CONCEPT-ART", "#FANTASY", "#RETRO", "#ANIME", "#GOTHIC"];

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
  "/auth": "Welcome back, Star. Let's get you signed in!",
  "/profile": "Customize away! Your vibe, your rules.",
  default: "Found any inspiration today, Star? ✨",
};
