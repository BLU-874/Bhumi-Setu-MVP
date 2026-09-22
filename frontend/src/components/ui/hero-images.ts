export type HeroImage = {
  src: string;
  alt: string;
  label: string;
  descriptor: string;
  context: string;
  sourceUrl: string;
  credit: string;
  license: string;
  licenseUrl: string;
  position?: string;
};

// Replace imagery here only. These are illustrative source examples from different
// locations, never a claimed set of corresponding records or model predictions.
export const HERO_IMAGES = {
  center: {
    src: '/images/hero/center-delhi.jpg',
    alt: 'Landsat satellite image of Delhi, with urban areas, the Yamuna River and surrounding agricultural land, June 2018.',
    label: 'DELHI / LANDSAT 8',
    descriptor: 'A wider view of the land',
    context: 'False-color satellite image · June 2018 · Illustrative imagery',
    sourceUrl: 'https://science.nasa.gov/earth/earth-observatory/urban-growth-of-new-delhi-92813/',
    credit: 'NASA Earth Observatory / Lauren Dauphin, Landsat data: USGS',
    license: 'NASA media usage guidelines',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    position: '38% 50%',
  },
  cadastral: {
    src: '/images/hero/cadastral.png',
    alt: 'Cadastral map showing individual land lots, streets and building outlines.',
    label: 'CADASTRAL',
    descriptor: 'Record geometry',
    context: 'Legacy land records in different formats and coordinate systems.',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ternopil_Cadastral_map_Rynek_1829-1862.png',
    credit: 'Unknown historical cartographer / Gesher Galicia, via Wikimedia Commons',
    license: 'Public domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
  },
  drone: {
    src: '/images/hero/drone.jpg',
    alt: 'Aerial photograph showing building patterns, roads and waterways; illustrative source imagery, not a model output.',
    label: 'DRONE AI',
    descriptor: 'Observed footprint',
    context: 'High-resolution aerial imagery used to derive building footprints.',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Surabaya_Aerial_1.jpg',
    credit: 'Slleong / Wikimedia Commons',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    position: 'right bottom',
  },
  gnss: {
    src: '/images/hero/gnss.jpg',
    alt: 'GNSS survey receiver, field controller and tripod used for terrestrial surveying.',
    label: 'GNSS',
    descriptor: 'Ground observation',
    context: 'Field survey data providing ground-position evidence.',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Trimble_GNSS_Messausr%C3%BCstung_R980_Empf%C3%A4nger.jpg',
    credit: 'Best Tech Nick 25 / Wikimedia Commons',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    position: 'center top',
  },
  reconciliation: {
    src: '/images/hero/bhumi-workspace.png',
    alt: 'Actual Bhumi-Setu workspace with synthetic parcel overlays, satellite context, layer controls and selected-record evidence.',
    label: 'RECONCILIATION',
    descriptor: 'One trusted picture',
    context: 'Machine learning, spatial evidence and human review for traceable reconciliation.',
    sourceUrl: '/map',
    credit: 'Bhumi-Setu synthetic demonstration; basemap: Esri, Vantor, Earthstar Geographics and the GIS User Community',
    license: 'Basemap attribution and usage',
    licenseUrl: 'https://doc.arcgis.com/en/arcgis-online/reference/display-copyrights.htm',
  },
} satisfies Record<string, HeroImage>;
