import nova from "@/assets/mascot-wave.png";
import comet from "@/assets/mascot-comet.png";
import raven from "@/assets/mascot-raven.png";
import vex from "@/assets/mascot-vex.png";
import pixel from "@/assets/mascot-pixel.png";

export type MascotKey = "nova" | "comet" | "raven" | "vex" | "pixel";

export const MASCOTS: Record<MascotKey, { name: string; tagline: string; image: string }> = {
  nova: { name: "Nova-chan", tagline: "Stellar energy", image: nova },
  comet: { name: "Comet-kun", tagline: "Cool & sharp", image: comet },
  raven: { name: "Raven", tagline: "Midnight mode", image: raven },
  vex: { name: "Dr. Vex", tagline: "Lab genius", image: vex },
  pixel: { name: "Pixel", tagline: "Retro brain", image: pixel },
};
