/** The examples featured in the README and on the demo site, in display order. */
export interface ShowcaseItem {
  name: string;
  title: string;
  durationSeconds: number;
  loops: boolean;
  blurb: string;
  credit: string;
}

export const FRAME_RATE = 30;

export const SHOWCASE: ShowcaseItem[] = [
  {
    name: 'cube-wave',
    title: 'Cube Wave',
    durationSeconds: 4,
    loops: true,
    blurb:
      'A field of columns rises and falls in a wave spreading from the center. WebGL with an isometric camera, and faces colored by hand instead of lit.',
    credit: "Dave Whyte (Bees & Bombs), 'cube wave'"
  },
  {
    name: 'pulsar-ridges',
    title: 'Pulsar Ridges',
    durationSeconds: 6,
    loops: true,
    blurb:
      'Seventy-two ridgelines, each hiding the ones behind it. Combs of subpulses drift through the peaks the way the pulsar CP 1919 really does.',
    credit:
      "Peter Saville's Unknown Pleasures cover, from Harold Craft's plot of pulsar CP 1919"
  },
  {
    name: 'clifford-bloom',
    title: 'Clifford Bloom',
    durationSeconds: 8,
    loops: true,
    blurb:
      'A million points of a Clifford attractor, binned into a density map each frame and tone-mapped from navy to warm white, while its parameters travel a closed loop.',
    credit: 'Clifford Pickover and the fractal flame renders of Scott Draves'
  },
  {
    name: 'flow-fibers',
    title: 'Flow Fibers',
    durationSeconds: 8,
    loops: false,
    blurb:
      'Hundreds of fibers, from bold ribbons to hairlines, grow along a noise flow field. Paths are planned against a collision grid, so strands bundle side by side and never pile up.',
    credit: 'Tyler Hobbs (Fidenza) and the flow-field tradition'
  },
  {
    name: 'truchet-weave',
    title: 'Truchet Weave',
    durationSeconds: 4,
    loops: true,
    blurb:
      'A wave sweeps across a grid of Truchet tiles. Each tile makes an eased quarter-turn, so the ribbons break apart and rejoin into a new maze.',
    credit:
      "Cyril Stanley Smith's Truchet tiles, with palettes after Vera Molnar and Kjetil Golid"
  },
  {
    name: 'reaction-diffusion',
    title: 'Reaction Diffusion',
    durationSeconds: 8,
    loops: false,
    blurb:
      'One seed grows into a coral maze that fills the frame. New growth glows coral and cools to cream, so the finished image records how it grew.',
    credit: "Gray-Scott Turing patterns, after Karl Sims' explainer"
  },
  {
    name: 'dot-lattice',
    title: 'Dot Lattice',
    durationSeconds: 4,
    loops: true,
    blurb:
      'A hexagonal lattice swings along its radii. Overlapping dots add up into bright rings, and ten sub-frame samples blur each dot into a streak.',
    credit: 'Etienne Jacob and Dave Whyte (Bees & Bombs)'
  },
  {
    name: 'schotter-drift',
    title: 'Schotter Drift',
    durationSeconds: 6,
    loops: true,
    blurb:
      'A column of inked squares, calm at the top and rubble at the bottom. A slow wave carries it from order to chaos and back.',
    credit: 'Georg Nees, Schotter (1968)'
  },
  {
    name: 'moire-orbit',
    title: 'Moire Orbit',
    durationSeconds: 6,
    loops: true,
    blurb:
      'Two sets of fine rings with slightly different spacing circle each other, and their interference makes broad spiral fringes that stream outward.',
    credit: "Bridget Riley's op art and Ryoji Ikeda's precise minimalism"
  }
];
