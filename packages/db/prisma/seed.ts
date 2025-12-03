import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { config as loadEnv } from "dotenv";

loadEnv();

const prisma = new PrismaClient();

type KeywordTemplate = {
  name: string;
  description: string;
  heading: string;
  summary: (title: string, note?: string) => string;
  watchFor: (focus?: string) => string;
  colorHint: string;
};

const KEYWORD_TEMPLATES = {
  colonialism: {
    name: "Colonial Pressure",
    description: "Imperial reach, assimilation, and cultural extraction.",
    heading: "Trace imperial pressure points",
    summary: (title: string, note?: string) =>
      `Watch how ${title} maps empire versus periphery${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) =>
      `Notice diplomacy, tribute, and coded resistance${focus ? ` (${focus})` : ""}.`,
    colorHint: "#c47f17"
  },
  identity: {
    name: "Layered Identity",
    description: "Questions of belonging, selfhood, and masks.",
    heading: "Follow layered identities",
    summary: (title: string, note?: string) =>
      `Consider how ${title} asks characters to negotiate who they are${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Track aliases, code-switching, and chosen names${focus ? ` (${focus})` : ""}.`,
    colorHint: "#9c27b0"
  },
  memory: {
    name: "Memory & Inheritance",
    description: "Collective history, archives, and legacy tech.",
    heading: "Chart how memory is stored",
    summary: (title: string, note?: string) =>
      `Observe how ${title} treats memory as power${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Log objects, songs, or rituals that hold the past${focus ? ` (${focus})` : ""}.`,
    colorHint: "#5d4037"
  },
  "political-intrigue": {
    name: "Political Intrigue",
    description: "Succession, negotiation, coups, and soft power.",
    heading: "Track the schemers",
    summary: (title: string, note?: string) =>
      `Map the alliances and betrayals that drive ${title}${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Flag council scenes, coded poetry, or informal deals${focus ? ` (${focus})` : ""}.`,
    colorHint: "#37474f"
  },
  language: {
    name: "Language & Translation",
    description: "Wordplay, etymology, poetry, and codes.",
    heading: "Trace the language games",
    summary: (title: string, note?: string) =>
      `Examine how ${title} uses language as leverage${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Note idioms, borrowed scripts, and translation mishaps${focus ? ` (${focus})` : ""}.`,
    colorHint: "#0c7cd5"
  },
  ecology: {
    name: "Ecological Systems",
    description: "Landscapes, symbiosis, and environmental costs.",
    heading: "Follow the living systems",
    summary: (title: string, note?: string) =>
      `Watch how ${title} ties character choices to ecosystems${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Mark recurring weather, flora, and resource metaphors${focus ? ` (${focus})` : ""}.`,
    colorHint: "#2e7d32"
  },
  climate: {
    name: "Climate Pressure",
    description: "Disaster, adaptation, and precarity.",
    heading: "Track climate pressure",
    summary: (title: string, note?: string) =>
      `Consider how ${title} imagines communities responding to climate strain${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Pay attention to migration choices, rationing, and shared shelters${focus ? ` (${focus})` : ""}.`,
    colorHint: "#0277bd"
  },
  technology: {
    name: "Disruptive Technology",
    description: "Tools that reshape economies or power.",
    heading: "Log disruptive tech",
    summary: (title: string, note?: string) =>
      `Notice how ${title} frames invention as both promise and threat${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Trace labs, prototypes, and the ethics they spark${focus ? ` (${focus})` : ""}.`,
    colorHint: "#424242"
  },
  "ai-ethics": {
    name: "Synthetic Agency",
    description: "AI, automation, and responsibility.",
    heading: "Question synthetic agency",
    summary: (title: string, note?: string) =>
      `Interrogate how ${title} distributes agency between humans and machines${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) =>
      `Spot consent checks, override clauses, and the emotional labor handed to AI${focus ? ` (${focus})` : ""}.`,
    colorHint: "#546e7a"
  },
  rebellion: {
    name: "Rebellion & Solidarity",
    description: "Grassroots strategy, uprisings, mutual aid.",
    heading: "Track the rebellion",
    summary: (title: string, note?: string) =>
      `Follow how ${title} depicts coalition building${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Flag secret meetings, coded art, and shifts in morale${focus ? ` (${focus})` : ""}.`,
    colorHint: "#bf360c"
  },
  authoritarianism: {
    name: "Authoritarian Creep",
    description: "Surveillance, propaganda, and control.",
    heading: "Watch authoritarian creep",
    summary: (title: string, note?: string) =>
      `Examine how ${title} shows power consolidating${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Track curfews, censorship, and loyalty rituals${focus ? ` (${focus})` : ""}.`,
    colorHint: "#880e4f"
  },
  prophecy: {
    name: "Prophecy & Fate",
    description: "Visions, omens, and self-fulfilling warnings.",
    heading: "Trace prophecy ripples",
    summary: (title: string, note?: string) =>
      `Consider how ${title} balances destiny with agency${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Watch for dreams, auguries, and who chooses to believe${focus ? ` (${focus})` : ""}.`,
    colorHint: "#6a1b9a"
  },
  religion: {
    name: "Faith & Ritual",
    description: "Theology, syncretism, sacred objects.",
    heading: "Study living faiths",
    summary: (title: string, note?: string) =>
      `Observe how ${title} stages worship, doubt, and community${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Track temples, songs, and taboos${focus ? ` (${focus})` : ""}.`,
    colorHint: "#f57f17"
  },
  myth: {
    name: "Myth & Retelling",
    description: "Classical echoes and narrative inheritance.",
    heading: "Follow mythic echoes",
    summary: (title: string, note?: string) =>
      `See how ${title} converses with older stories${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Log invocations, heroic epithets, and subverted archetypes${focus ? ` (${focus})` : ""}.`,
    colorHint: "#ff7043"
  },
  trauma: {
    name: "Trauma & Aftercare",
    description: "Wounds, coping, and accountability.",
    heading: "Observe trauma responses",
    summary: (title: string, note?: string) =>
      `Notice how ${title} acknowledges harm and recovery${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Trace grounding rituals, flashbacks, and trusted confidants${focus ? ` (${focus})` : ""}.`,
    colorHint: "#ad1457"
  },
  healing: {
    name: "Healing & Restoration",
    description: "Community care, rebuilding, mending.",
    heading: "Note the work of repair",
    summary: (title: string, note?: string) =>
      `Watch how ${title} invests in healing practices${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Mark shared meals, creative play, and intergenerational teaching${focus ? ` (${focus})` : ""}.`,
    colorHint: "#66bb6a"
  },
  "found-family": {
    name: "Found Family",
    description: "Mutual trust, chosen kin, and team dynamics.",
    heading: "Watch the found family take shape",
    summary: (title: string, note?: string) =>
      `Follow how ${title} builds trust between unlikely allies${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Track acts of service, inside jokes, and defense of group boundaries${focus ? ` (${focus})` : ""}.`,
    colorHint: "#1e88e5"
  },
  class: {
    name: "Class & Labor",
    description: "Wealth gaps, craft, and invisible work.",
    heading: "Track class friction",
    summary: (title: string, note?: string) =>
      `Consider how ${title} surfaces labor politics${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) =>
      `Note uniforms, tipping rituals, and whose work is considered noble${focus ? ` (${focus})` : ""}.`,
    colorHint: "#795548"
  },
  surveillance: {
    name: "Surveillance",
    description: "Observation tech, informants, panopticons.",
    heading: "Follow the watchers",
    summary: (title: string, note?: string) =>
      `Examine how ${title} imagines being seen or recorded${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Highlight security feeds, notebooks, or prophetic visions used as intel${focus ? ` (${focus})` : ""}.`,
    colorHint: "#263238"
  },
  gender: {
    name: "Gender & Expression",
    description: "Expectation, fluidity, and coded roles.",
    heading: "Observe gender performance",
    summary: (title: string, note?: string) =>
      `Track how ${title} plays with gendered expectations${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Notice clothing, pronoun shifts, and bodily autonomy debates${focus ? ` (${focus})` : ""}.`,
    colorHint: "#ec407a"
  },
  migration: {
    name: "Migration & Diaspora",
    description: "Home, exile, and cross-border resilience.",
    heading: "Trace migrations",
    summary: (title: string, note?: string) =>
      `Consider how ${title} frames movement and belonging${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Mark border crossings, letters home, and remittance negotiations${focus ? ` (${focus})` : ""}.`,
    colorHint: "#00897b"
  },
  resilience: {
    name: "Resilience & Hope",
    description: "Optimism, small wins, and future building.",
    heading: "Collect hopeful sparks",
    summary: (title: string, note?: string) =>
      `Notice where ${title} makes space for hope${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Track moments of laughter, art, and shared vision boards${focus ? ` (${focus})` : ""}.`,
    colorHint: "#ffca28"
  },
  time: {
    name: "Time & Structure",
    description: "Non-linear storytelling, loops, and prophecy.",
    heading: "Interrogate time",
    summary: (title: string, note?: string) =>
      `Watch how ${title} bends timelines${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Map flashbacks, nested tales, and foreshadowing experiments${focus ? ` (${focus})` : ""}.`,
    colorHint: "#3f51b5"
  },
  storytelling: {
    name: "Stories about Stories",
    description: "Metafiction, oral history, archives.",
    heading: "Track storytellers",
    summary: (title: string, note?: string) =>
      `Consider who narrates ${title} and why${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Note frame narratives, unreliable guides, and contested sources${focus ? ` (${focus})` : ""}.`,
    colorHint: "#a1887f"
  },
  "war-ethics": {
    name: "War & Ethics",
    description: "Just war, collateral damage, and strategy.",
    heading: "Question war ethics",
    summary: (title: string, note?: string) =>
      `Analyze how ${title} justifies violence${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Flag command briefings, oaths, and dissenting officers${focus ? ` (${focus})` : ""}.`,
    colorHint: "#b71c1c"
  },
  hope: {
    name: "Hopepunk Threads",
    description: "Radical optimism and communal care.",
    heading: "Gather hopepunk signals",
    summary: (title: string, note?: string) =>
      `Pay attention to how ${title} insists on care${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Mark resource sharing, public art, and stubborn joy${focus ? ` (${focus})` : ""}.`,
    colorHint: "#ff8f00"
  },
  grief: {
    name: "Grief & Remembrance",
    description: "Mourning rituals and what comes after.",
    heading: "Sit with grief",
    summary: (title: string, note?: string) =>
      `Notice how ${title} honors the dead${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Track wakes, memorial art, and conflicting stories about loss${focus ? ` (${focus})` : ""}.`,
    colorHint: "#455a64"
  },
  "magic-systems": {
    name: "Magic Systems",
    description: "Rules, costs, and cultural grounding of magic.",
    heading: "Study the magic system",
    summary: (title: string, note?: string) =>
      `Look at how ${title} defines power limits${note ? ` — ${note}` : ""}.`,
    watchFor: (focus?: string) => `Catalog ingredients, oaths, and the price each casting demands${focus ? ` (${focus})` : ""}.`,
    colorHint: "#ab47bc"
  }
} satisfies Record<string, KeywordTemplate>;

type KeywordSlug = keyof typeof KEYWORD_TEMPLATES;

const GENRE_CATALOG = {
  "science-fiction": {
    name: "Science Fiction",
    description: "Speculative science, futures, and alternate technologies."
  },
  "space-opera": {
    name: "Space Opera",
    description: "Expansive interstellar adventures and empires."
  },
  fantasy: {
    name: "Fantasy",
    description: "Magic, myth, and alternate realities."
  },
  "epic-fantasy": {
    name: "Epic Fantasy",
    description: "Multibook sagas with sweeping stakes."
  },
  "political-thriller": {
    name: "Political Thriller",
    description: "Coup attempts, diplomacy, and backroom deals."
  },
  "literary-fiction": {
    name: "Literary Fiction",
    description: "Character-driven narratives and stylistic innovation."
  },
  "historical-fiction": {
    name: "Historical Fiction",
    description: "Stories grounded in specific past eras."
  },
  "myth-retelling": {
    name: "Myth Retelling",
    description: "Reimagined epics, legends, and folktales."
  },
  "post-apocalyptic": {
    name: "Post-Apocalyptic",
    description: "Aftermath of collapse and survival tales."
  },
  dystopian: {
    name: "Dystopian",
    description: "Authoritarian or controlled societies."
  },
  "afrofuturism": {
    name: "Afrofuturism",
    description: "Black speculative futures and mythmaking."
  },
  "urban-fantasy": {
    name: "Urban Fantasy",
    description: "Magic layered onto contemporary cities."
  },
  horror: {
    name: "Horror",
    description: "Fear, dread, and uncanny transformations."
  },
  "cli-fi": {
    name: "Climate Fiction",
    description: "Stories centered on climate disruption."
  },
  "magical-realism": {
    name: "Magical Realism",
    description: "Mythic elements threaded through realist settings."
  },
  "speculative-nonfiction": {
    name: "Speculative Nonfiction",
    description: "Science-rooted meditations on possibility."
  },
  cyberpunk: {
    name: "Cyberpunk",
    description: "High tech, low life, and networked rebellions."
  },
  "military-sf": {
    name: "Military SF",
    description: "Tactics, command, and combat consequences."
  },
  "philosophical-sf": {
    name: "Philosophical SF",
    description: "Existential questions framed through speculative tech."
  },
  romance: {
    name: "Romance",
    description: "Central love arcs and emotional payoffs."
  },
  "young-adult": {
    name: "Young Adult",
    description: "Coming-of-age arcs anchored in teen protagonists."
  }
} as const;

type GenreSlug = keyof typeof GENRE_CATALOG;

type SeedPrep = {
  keyword: KeywordSlug;
  note?: string;
  focus?: string;
  heading?: string;
  color?: string;
  extraKeywords?: KeywordSlug[];
};

type SeedBook = {
  title: string;
  author: string;
  synopsis: string;
  publishedYear?: number;
  genres: GenreSlug[];
  preps: SeedPrep[];
};

type SeriesSeed = {
  author: string;
  books: Array<Omit<SeedBook, "author">>;
};

const SERIES: SeriesSeed[] = [
  {
    author: "Arkady Martine",
    books: [
      {
        title: "A Memory Called Empire",
        synopsis:
          "Mahit Dzmare is dispatched from a tiny mining station to navigate the poetry-soaked empire that threatens to absorb her home.",
        publishedYear: 2019,
        genres: ["science-fiction", "space-opera", "political-thriller"],
        preps: [
          {
            keyword: "colonialism",
            note: "Mahit's borrowed identity collides with Teixcalaan ceremony.",
            focus: "Moments where etiquette manuals and actual practice diverge.",
            extraKeywords: ["identity"]
          },
          {
            keyword: "memory",
            note: "Imago backups blur personhood with recorded advice.",
            focus: "Transitions where Mahit defers to Yskandr's whisper."
          },
          {
            keyword: "political-intrigue",
            note: "Succession fractures the capital long before open conflict.",
            focus: "Every poem as policy memo."
          }
        ]
      },
      {
        title: "A Desolation Called Peace",
        synopsis:
          "Teixcalaan faces an unknowable foe, while Mahit and Three Seagrass test the limits of diplomacy, translation, and trust.",
        publishedYear: 2021,
        genres: ["science-fiction", "space-opera", "political-thriller"],
        preps: [
          {
            keyword: "language",
            note: "Communication with the enemy hinges on metaphors of hunger.",
            focus: "Scene work inside the warship linguistics lab."
          },
          {
            keyword: "ai-ethics",
            note: "Fleet minds and imago lineages clash over who commands a body.",
            focus: "Debates about consent when memories persist past death.",
            extraKeywords: ["memory"]
          },
          {
            keyword: "war-ethics",
            note: "Peace terms hinge on whether annihilation is imaginable.",
            focus: "Admiralty briefings and the poetry they circulate."
          }
        ]
      }
    ]
  },
  {
    author: "N.K. Jemisin",
    books: [
      {
        title: "The Fifth Season",
        synopsis:
          "On a continent wracked by apocalyptic Seasons, three orogenes fight for survival and a future where their power is not shackled.",
        publishedYear: 2015,
        genres: ["science-fiction", "fantasy", "cli-fi"],
        preps: [
          {
            keyword: "climate",
            note: "Every Season is a study in systemic neglect.",
            focus: "Fulcrum handbooks vs. lived experience of comms."
          },
          {
            keyword: "trauma",
            note: "Essun carries compounded grief across timelines.",
            focus: "Scenes where a new identity is adopted in anger.",
            extraKeywords: ["grief"]
          },
          {
            keyword: "authoritarianism",
            note: "Fulcrum 'education' weaponizes math and stillness.",
            focus: "Classes on node maintainers and personal cost.",
            extraKeywords: ["class"]
          }
        ]
      },
      {
        title: "The Obelisk Gate",
        synopsis:
          "Essun trains within Castrima's hollow geode while Nassun learns what obedience costs, and obelisks stir above them both.",
        publishedYear: 2016,
        genres: ["science-fiction", "fantasy", "cli-fi"],
        preps: [
          {
            keyword: "magic-systems",
            note: "Obelisks complicate what it means to feel the earth.",
            focus: "Training montages that treat stone like memory."
          },
          {
            keyword: "found-family",
            note: "Castrima negotiates how to protect its own while letting strangers in.",
            focus: "Town meetings and kitchen duty assignments."
          },
          {
            keyword: "grief",
            note: "Nassun rewrites her relationship to justice after Schaffa's revelations.",
            focus: "Moments where she names her anger."
          }
        ]
      },
      {
        title: "The Stone Sky",
        synopsis:
          "Mother and daughter race toward Corepoint to end the cyclical Seasons, forcing a reckoning with Hoa's long-guarded past.",
        publishedYear: 2017,
        genres: ["science-fiction", "fantasy", "cli-fi"],
        preps: [
          {
            keyword: "memory",
            note: "Hoa's chapters reframe the entire trilogy.",
            focus: "Hearing stone eaters narrate the before times."
          },
          {
            keyword: "rebellion",
            note: "A Syl Anagist heist explains why the earth screams.",
            focus: "Scenes planning the engine sabotage."
          },
          {
            keyword: "healing",
            note: "Essun and Nassun must decide if love can be rebuilt mid-cataclysm.",
            focus: "Negotiations over the moon's return."
          }
        ]
      },
      {
        title: "The City We Became",
        synopsis:
          "New York's borough avatars wake up to fight interdimensional colonization with graffiti, math, and mutual aid.",
        publishedYear: 2020,
        genres: ["fantasy", "urban-fantasy", "afrofuturism"],
        preps: [
          {
            keyword: "colonialism",
            note: "The Enemy's tendrils mimic gentrification and philanthropy.",
            focus: "Moments featuring white tentacles disguised as modern art."
          },
          {
            keyword: "found-family",
            note: "The avatars must accept each other before the city can breathe.",
            focus: "Anytime Aislyn is missing from the group chat."
          },
          {
            keyword: "resilience",
            note: "Street art, ballroom, and math duels become defense mechanisms.",
            focus: "Impromptu concerts used as counter-summons."
          }
        ]
      }
    ]
  },
  {
    author: "Ursula K. Le Guin",
    books: [
      {
        title: "The Left Hand of Darkness",
        synopsis:
          "Envoy Genly Ai must learn trust on Gethen, where gender shifts with the cycle of kemmer and loyalty is measured in snowstorms.",
        publishedYear: 1969,
        genres: ["science-fiction", "political-thriller", "philosophical-sf"],
        preps: [
          {
            keyword: "gender",
            note: "Gethenians refuse fixed categories.",
            focus: "Moments in karhider courts where pronouns slip."
          },
          {
            keyword: "political-intrigue",
            note: "Orgoreyn files everything; Karhide sings its secrets.",
            focus: "Bureaucratic memos vs. Estraven's oblique advice."
          },
          {
            keyword: "found-family",
            note: "The ice crossing redefines friendship.",
            focus: "Rituals invented on the glacier."
          }
        ]
      },
      {
        title: "The Dispossessed",
        synopsis:
          "Physicist Shevek travels from the anarchist moon Anarres to the capitalist planet Urras seeking a way to share his General Temporal Theory.",
        publishedYear: 1974,
        genres: ["science-fiction", "philosophical-sf", "political-thriller"],
        preps: [
          {
            keyword: "class",
            note: "Compare dorm syndicates with Urrasti salons.",
            focus: "Scenes where Odo's writings are quoted."
          },
          {
            keyword: "time",
            note: "Simultaneity theory mirrors circular narrative structure.",
            focus: "Look for alternating chapter timelines."
          },
          {
            keyword: "rebellion",
            note: "Anarresti protests reveal stagnation even within utopia.",
            focus: "Public posting boards and who tears down which flyer."
          }
        ]
      }
    ]
  },
  {
    author: "Frank Herbert",
    books: [
      {
        title: "Dune",
        synopsis:
          "Paul Atreides is thrust into the politics of Arrakis, where spice, prophecy, and ecology converge.",
        publishedYear: 1965,
        genres: ["science-fiction", "space-opera", "epic-fantasy"],
        preps: [
          {
            keyword: "ecology",
            note: "Fremen water discipline is world-building as resistance.",
            focus: "Watch Liet-Kynes briefings and sietch rituals."
          },
          {
            keyword: "prophecy",
            note: "Missionaria Protectiva seeded Paul's legend.",
            focus: "Reverend Mother whispers vs. Fremen oral history."
          },
          {
            keyword: "war-ethics",
            note: "Paul grapples with jihad visions.",
            focus: "Scenes describing fanatical armies in prescient dreams."
          }
        ]
      },
      {
        title: "Dune Messiah",
        synopsis:
          "Years into Paul's reign, conspirators test how far a messiah can fall without losing absolute power.",
        publishedYear: 1969,
        genres: ["science-fiction", "space-opera"],
        preps: [
          {
            keyword: "authoritarianism",
            note: "All policies orbit Paul's prescience.",
            focus: "Public works vs. the terror in Paul's visions."
          },
          {
            keyword: "identity",
            note: "Hayt's ghola memories complicate loyalty.",
            focus: "Moments where Duncan's body language betrays echoes."
          },
          {
            keyword: "grief",
            note: "Chani and Irulan's choices are rooted in loss.",
            focus: "Fremen laments woven into politics."
          }
        ]
      },
      {
        title: "Children of Dune",
        synopsis:
          "Leto II and Ghanima inherit an empire at risk of stagnation, forcing metamorphosis.",
        publishedYear: 1976,
        genres: ["science-fiction", "space-opera"],
        preps: [
          {
            keyword: "memory",
            note: "Atreides twins manage ancestral voices.",
            focus: "The Abomination warnings from Bene Gesserit training."
          },
          {
            keyword: "ecology",
            note: "Terraforming carries unintended consequences.",
            focus: "Thufir's weather reports vs. desert nostalgia."
          },
          {
            keyword: "prophecy",
            note: "The Golden Path demands sacrifice.",
            focus: "Maps of possible timelines pinned to Leto's mind."
          }
        ]
      }
    ]
  },
  {
    author: "Octavia Butler",
    books: [
      {
        title: "Kindred",
        synopsis:
          "Dana Franklin is yanked through time to save an ancestor in antebellum Maryland, confronting the mechanics of survival under slavery.",
        publishedYear: 1979,
        genres: ["science-fiction", "historical-fiction", "literary-fiction"],
        preps: [
          {
            keyword: "time",
            note: "Each jump tests causal responsibility.",
            focus: "Pay attention to injuries traveling across centuries."
          },
          {
            keyword: "trauma",
            note: "Dana keeps tally of compromises.",
            focus: "Scenes where she journals to stay grounded."
          },
          {
            keyword: "class",
            note: "Labor and literacy determine survival options.",
            focus: "Notice who is taught to read and why."
          }
        ]
      },
      {
        title: "Parable of the Sower",
        synopsis:
          "Lauren Olamina flees a collapsing walled community and nurtures Earthseed amid climate chaos.",
        publishedYear: 1993,
        genres: ["science-fiction", "cli-fi", "dystopian"],
        preps: [
          {
            keyword: "climate",
            note: "Heat and scarcity shape every decision.",
            focus: "Ledger entries tracking water and seeds."
          },
          {
            keyword: "religion",
            note: "Earthseed versus inherited Christian liturgy.",
            focus: "Verses inserted between journal entries."
          },
          {
            keyword: "found-family",
            note: "Acorn is built one trust exercise at a time.",
            focus: "Moments where hyperempathy alters conflict."
          }
        ]
      },
      {
        title: "Parable of the Talents",
        synopsis:
          "Earthseed confronts a theocratic president, testing whether destiny can include the stars.",
        publishedYear: 1998,
        genres: ["science-fiction", "cli-fi", "dystopian"],
        preps: [
          {
            keyword: "authoritarianism",
            note: "The Crusaders weaponize patriotism.",
            focus: "Sermons from President Jarret and their echoes."
          },
          {
            keyword: "grief",
            note: "Lauren narrates loss while her daughter critiques her.",
            focus: "Layered journal commentary between generations."
          },
          {
            keyword: "resilience",
            note: "Earthseed chapters end on action items.",
            focus: "Community bylaws drafted after every crisis."
          }
        ]
      }
    ]
  },
  {
    author: "Ann Leckie",
    books: [
      {
        title: "Ancillary Justice",
        synopsis:
          "Breq, once a troopship AI, hunts the Radch ruler responsible for fracturing her mind.",
        publishedYear: 2013,
        genres: ["science-fiction", "space-opera", "political-thriller"],
        preps: [
          {
            keyword: "identity",
            note: "One consciousness spread across thousands of bodies.",
            focus: "Pay attention to grammatical shifts when Breq recalls the past.",
            extraKeywords: ["ai-ethics"]
          },
          {
            keyword: "colonialism",
            note: "Annexations hide behind tea ceremonies.",
            focus: "Contrasts between conquered etiquette and Radchaai norms."
          },
          {
            keyword: "political-intrigue",
            note: "Anaander Mianaai is her own worst rival.",
            focus: "Memorize which clone controls each palace wing."
          }
        ]
      },
      {
        title: "Ancillary Sword",
        synopsis:
          "Breq takes command of Mercy of Kalr and uncovers unrest on an outlying station.",
        publishedYear: 2014,
        genres: ["science-fiction", "space-opera"],
        preps: [
          {
            keyword: "class",
            note: "Station labor disputes reveal Radchaai hypocrisy.",
            focus: "Household shrines cataloging ancestors."
          },
          {
            keyword: "found-family",
            note: "Mercy of Kalr's crew calibrates trust via rituals.",
            focus: "Instruction cards pinned to every ready-room bulkhead."
          },
          {
            keyword: "war-ethics",
            note: "Presger treaties limit every tactical choice.",
            focus: "Negotiations with Translator Zeiat."
          }
        ]
      },
      {
        title: "Ancillary Mercy",
        synopsis:
          "Civil war reaches Athoek as Presger observers arrive to judge the Radch.",
        publishedYear: 2015,
        genres: ["science-fiction", "space-opera"],
        preps: [
          {
            keyword: "ai-ethics",
            note: "Station Twelve asserts personhood.",
            focus: "Scenes where facilities refuse harmful orders."
          },
          {
            keyword: "rebellion",
            note: "Small acts of refusal cascade across the system.",
            focus: "Radio broadcasts disguised as song dedications."
          },
          {
            keyword: "resilience",
            note: "Tea service doubles as collective grounding.",
            focus: "Mercy of Kalr's inventory lists as emotional check-ins."
          }
        ]
      }
    ]
  },
  {
    author: "James S. A. Corey",
    books: [
      {
        title: "Leviathan Wakes",
        synopsis:
          "Holden and Miller investigate a disappearing freighter and uncover the protomolecule.",
        publishedYear: 2011,
        genres: ["science-fiction", "space-opera", "military-sf"],
        preps: [
          {
            keyword: "technology",
            note: "Alien biotech rewrites every rule of physics.",
            focus: "Track Julie Mao's crash couch footage."
          },
          {
            keyword: "found-family",
            note: "The Rocinante crew builds trust under fire.",
            focus: "Galley conversations after each system-wide broadcast."
          },
          {
            keyword: "political-intrigue",
            note: "The Belt, Mars, and Earth weaponize every rumor.",
            focus: "Press conferences intercut with private calls."
          }
        ]
      },
      {
        title: "Caliban's War",
        synopsis:
          "OPA tensions spike as a protomolecule super soldier threatens Ganymede's children.",
        publishedYear: 2012,
        genres: ["science-fiction", "space-opera", "military-sf"],
        preps: [
          {
            keyword: "war-ethics",
            note: "MCRN and UN brass disagree on acceptable losses.",
            focus: "Bobbie's testimony transcripts."
          },
          {
            keyword: "trauma",
            note: "Prax processes parenthood mid-collapse.",
            focus: "Hydroponic metaphors in his internal monologue."
          },
          {
            keyword: "rebellion",
            note: "Avasarala weaponizes bureaucracy for justice.",
            focus: "The edits she makes in pen on classified briefs."
          }
        ]
      },
      {
        title: "Abaddon's Gate",
        synopsis:
          "Humanity enters the Ring, facing zealotry, coups, and protomolecule judgment.",
        publishedYear: 2013,
        genres: ["science-fiction", "space-opera", "philosophical-sf"],
        preps: [
          {
            keyword: "religion",
            note: "Pastor Anna frames the unknown as revelation.",
            focus: "Sermons delivered over shipwide comms."
          },
          {
            keyword: "authoritarianism",
            note: "Ashford's control contrasts Bull's pragmatism.",
            focus: "Command chair debates recorded by the Behemoth."
          },
          {
            keyword: "hope",
            note: "Naomi insists on a third option between defeat and surrender.",
            focus: "Engineering sketches taped inside the drum."
          }
        ]
      }
    ]
  },
  {
    author: "Susanna Clarke",
    books: [
      {
        title: "Jonathan Strange & Mr Norrell",
        synopsis:
          "Two magicians revive English magic and unleash the Gentleman with Thistledown Hair.",
        publishedYear: 2004,
        genres: ["fantasy", "historical-fiction", "literary-fiction"],
        preps: [
          {
            keyword: "magic-systems",
            note: "Footnotes build the rulebook.",
            focus: "Who owns each grimorie cited."
          },
          {
            keyword: "myth",
            note: "Raven King legends haunt every ballroom.",
            focus: "Faerie bargains sealed with dance."
          },
          {
            keyword: "storytelling",
            note: "Historians argue about credit mid-chapter.",
            focus: "Annotator squabbles in the margins."
          }
        ]
      },
      {
        title: "Piranesi",
        synopsis:
          "A solitary man maps a labyrinthine House of statues and tides.",
        publishedYear: 2020,
        genres: ["fantasy", "literary-fiction", "philosophical-sf"],
        preps: [
          {
            keyword: "memory",
            note: "Journals keep reality coherent.",
            focus: "Changes in tone around entry numbering."
          },
          {
            keyword: "healing",
            note: "Rituals of gratitude stave off despair.",
            focus: "Shared meals with birds and statues."
          },
          {
            keyword: "storytelling",
            note: "The narrative itself becomes an offering.",
            focus: "Moments where the House responds."
          }
        ]
      }
    ]
  },
  {
    author: "Erin Morgenstern",
    books: [
      {
        title: "The Night Circus",
        synopsis:
          "A traveling circus becomes the stage for a decades-long magical duel that blooms into collaboration.",
        publishedYear: 2011,
        genres: ["fantasy", "romance", "literary-fiction"],
        preps: [
          {
            keyword: "magic-systems",
            note: "Every tent encodes the duel's rules.",
            focus: "Pay attention to mirrored tricks."
          },
          {
            keyword: "found-family",
            note: "Rêveurs sustain the circus between cities.",
            focus: "Red scarf rituals and midnight dinners."
          },
          {
            keyword: "resilience",
            note: "Art becomes a survival plan.",
            focus: "Snippets of the Widget and Poppet storytelling show."
          }
        ]
      }
    ]
  },
  {
    author: "Emily St. John Mandel",
    books: [
      {
        title: "Station Eleven",
        synopsis:
          "A traveling symphony performs Shakespeare in the aftermath of a pandemic, linking actors, artists, and archivists.",
        publishedYear: 2014,
        genres: ["science-fiction", "post-apocalyptic", "literary-fiction"],
        preps: [
          {
            keyword: "storytelling",
            note: "The Dr. Eleven comic mirrors the road.",
            focus: "Museum of Civilization placards."
          },
          {
            keyword: "climate",
            note: "Weather dictates rehearsal choices.",
            focus: "Route maps pinned to caravan wagons."
          },
          {
            keyword: "hope",
            note: "Performances insist survival is insufficient.",
            focus: "Moments when the audience hums along."
          }
        ]
      },
      {
        title: "Sea of Tranquility",
        synopsis:
          "Time anomalies connect a 1912 exile, a novelist, a detective, and a lunar colony.",
        publishedYear: 2022,
        genres: ["science-fiction", "philosophical-sf", "literary-fiction"],
        preps: [
          {
            keyword: "time",
            note: "Nested narratives fold into one another.",
            focus: "Each violin loop sighting."
          },
          {
            keyword: "migration",
            note: "Characters leave Earth for domed moons.",
            focus: "Customs checkpoints described in travel logs."
          },
          {
            keyword: "grief",
            note: "Pandemics echo across diaries.",
            focus: "Letters appended to archival transcripts."
          }
        ]
      }
    ]
  },
  {
    author: "Liu Cixin",
    books: [
      {
        title: "The Three-Body Problem",
        synopsis:
          "Secret projects in Cultural Revolution China contact the Trisolaran civilization.",
        publishedYear: 2006,
        genres: ["science-fiction", "philosophical-sf"],
        preps: [
          {
            keyword: "authoritarianism",
            note: "Political campaigns ripple through academia.",
            focus: "Red Coast Base protocols."
          },
          {
            keyword: "technology",
            note: "The three-body VR game encodes alien history.",
            focus: "Puzzle scenes with the countdown in the sky."
          },
          {
            keyword: "war-ethics",
            note: "E.T. contact debates are life-or-death.",
            focus: "Letters Ye Wenjie sends into space."
          }
        ]
      },
      {
        title: "The Dark Forest",
        synopsis:
          "Earth builds deterrents while Trisolaris dispatches sophons to surveil humanity.",
        publishedYear: 2008,
        genres: ["science-fiction", "military-sf", "philosophical-sf"],
        preps: [
          {
            keyword: "surveillance",
            note: "Sophons watch every laboratory.",
            focus: "Scenes where physicists perform for invisible audiences."
          },
          {
            keyword: "political-intrigue",
            note: "Wallfacers weaponize secrecy.",
            focus: "Council debates about Luo Ji's plan."
          },
          {
            keyword: "hope",
            note: "Dark Forest theory both terrifies and motivates.",
            focus: "Moments when Luo Ji sketches the cosmic map."
          }
        ]
      },
      {
        title: "Death's End",
        synopsis:
          "The Trisolaran crisis expands into cosmic-scale warfare and dimensional weapons.",
        publishedYear: 2010,
        genres: ["science-fiction", "philosophical-sf"],
        preps: [
          {
            keyword: "war-ethics",
            note: "Swordholder duty defines survival.",
            focus: "Che Chengxin's internal debates."
          },
          {
            keyword: "time",
            note: "Centuries pass via hibernation.",
            focus: "Snapshots of future eras inserted mid-chapter."
          },
          {
            keyword: "grief",
            note: "Entire civilizations vanish in an instant.",
            focus: "Memorials described after each dimensional strike."
          }
        ]
      }
    ]
  },
  {
    author: "Patrick Rothfuss",
    books: [
      {
        title: "The Name of the Wind",
        synopsis:
          "Kvothe recounts his childhood, the Chandrian attack, and his first years at the University.",
        publishedYear: 2007,
        genres: ["fantasy", "epic-fantasy"],
        preps: [
          {
            keyword: "storytelling",
            note: "The framing device reframes truth.",
            focus: "Chronicler's interjections."
          },
          {
            keyword: "magic-systems",
            note: "Sympathy balances cost and precision.",
            focus: "Tuition payments tied to arcanist privileges."
          },
          {
            keyword: "trauma",
            note: "Edema Ruh losses haunt every decision.",
            focus: "Songs rewoven into laments."
          }
        ]
      },
      {
        title: "The Wise Man's Fear",
        synopsis:
          "Kvothe travels beyond the University, confronting the Adem, Felurian, and Maer's court.",
        publishedYear: 2011,
        genres: ["fantasy", "epic-fantasy"],
        preps: [
          {
            keyword: "identity",
            note: "Different cultures rename Kvothe.",
            focus: "Etiquette differences between Severen and Haert."
          },
          {
            keyword: "found-family",
            note: "Wilem, Simmon, and Devi hold him accountable.",
            focus: "Scenes in the Archives stacks."
          },
          {
            keyword: "magic-systems",
            note: "Naming magic contradicts sympathy lessons.",
            focus: "Felurian's teachings vs. Arwyl's lectures."
          }
        ]
      }
    ]
  },
  {
    author: "Brandon Sanderson",
    books: [
      {
        title: "The Way of Kings",
        synopsis:
          "Kaladin, Shallan, and Dalinar navigate war on the Shattered Plains while spren awaken.",
        publishedYear: 2010,
        genres: ["fantasy", "epic-fantasy"],
        preps: [
          {
            keyword: "magic-systems",
            note: "Stormlight economics govern every battle.",
            focus: "Schedules for highstorm chasms."
          },
          {
            keyword: "class",
            note: "Alethi lighteyes and darkeyes divide labor.",
            focus: "Bridge run rosters and pay ledgers."
          },
          {
            keyword: "found-family",
            note: "Bridge Four invents care rituals.",
            focus: "Glyphs painted on shields."
          }
        ]
      },
      {
        title: "Words of Radiance",
        synopsis:
          "Oaths deepen as Parshendi singers and Radiants choose their futures.",
        publishedYear: 2014,
        genres: ["fantasy", "epic-fantasy"],
        preps: [
          {
            keyword: "identity",
            note: "Shallan keeps masks within masks.",
            focus: "Sketchbook spreads."
          },
          {
            keyword: "war-ethics",
            note: "Dalinar questions the cost of vengeance.",
            focus: "Conversations with the Stormfather."
          },
          {
            keyword: "hope",
            note: "Bridge Four extends care beyond the chasms.",
            focus: "Tattoo ceremonies."
          }
        ]
      },
      {
        title: "Oathbringer",
        synopsis:
          "Coalitions form in Urithiru while secrets about the Recreance surface.",
        publishedYear: 2017,
        genres: ["fantasy", "epic-fantasy"],
        preps: [
          {
            keyword: "trauma",
            note: "Dalinar confronts the Blackthorn's past.",
            focus: "Feast flashbacks."
          },
          {
            keyword: "prophecy",
            note: "Visions reinterpret historical oaths.",
            focus: "Stormfather transcripts."
          },
          {
            keyword: "resilience",
            note: "Urithiru residents craft new commons.",
            focus: "Community cooking rotations."
          }
        ]
      },
      {
        title: "Rhythm of War",
        synopsis:
          "Humans and singers experiment with fabrials and rhythms while Navani redefines scholarship.",
        publishedYear: 2020,
        genres: ["fantasy", "epic-fantasy"],
        preps: [
          {
            keyword: "technology",
            note: "Fabrial science becomes a frontline.",
            focus: "Navani's lab journal headings."
          },
          {
            keyword: "healing",
            note: "Mental health conversations take center stage.",
            focus: "Kaladin's sessions with the ardents."
          },
          {
            keyword: "rebellion",
            note: "Singer coalitions debate autonomy.",
            focus: "Listener songs translated mid-battle."
          }
        ]
      },
      {
        title: "Mistborn: The Final Empire",
        synopsis:
          "Vin joins a thieving crew to overthrow the immortal Lord Ruler with allomancy.",
        publishedYear: 2006,
        genres: ["fantasy", "epic-fantasy"],
        preps: [
          {
            keyword: "class",
            note: "Skaa rebellions hinge on resource sharing.",
            focus: "Keep inventories.",
            extraKeywords: ["rebellion"]
          },
          {
            keyword: "magic-systems",
            note: "Allomantic metals have specific costs.",
            focus: "Vin's training montages."
          },
          {
            keyword: "identity",
            note: "Vin balances street instincts with noble masquerades.",
            focus: "Scenes with the cameo earrings."
          }
        ]
      },
      {
        title: "The Well of Ascension",
        synopsis:
          "Elend struggles to rule while assassins and armies close in on Luthadel.",
        publishedYear: 2007,
        genres: ["fantasy", "epic-fantasy"],
        preps: [
          {
            keyword: "political-intrigue",
            note: "Parliament debates rewrite alliances.",
            focus: "Demarals exchanging votes."
          },
          {
            keyword: "hope",
            note: "Sazed keeps cataloging religions even as belief falters.",
            focus: "Metalogical appendices."
          },
          {
            keyword: "war-ethics",
            note: "Vin asks what collateral damage is acceptable.",
            focus: "Mistborn aerial assaults described in detail."
          }
        ]
      },
      {
        title: "The Hero of Ages",
        synopsis:
          "Ruin and Preservation fight through Vin and Elend's final stand.",
        publishedYear: 2008,
        genres: ["fantasy", "epic-fantasy"],
        preps: [
          {
            keyword: "prophecy",
            note: "Coppermind prophecies hide redactions.",
            focus: "Epigraph commentary."
          },
          {
            keyword: "grief",
            note: "Sazed narrates loss while seeking balance.",
            focus: "Kandra contracts torn apart."
          },
          {
            keyword: "hope",
            note: "The ending reframes sacrifice.",
            focus: "Ashfalls described near the end."
          }
        ]
      }
    ]
  },
  {
    author: "J.R.R. Tolkien",
    books: [
      {
        title: "The Hobbit",
        synopsis:
          "Bilbo Baggins leaves the Shire with thirteen dwarves to reclaim Erebor.",
        publishedYear: 1937,
        genres: ["fantasy", "epic-fantasy"],
        preps: [
          {
            keyword: "myth",
            note: "Fairy-tale structure hides deep lore.",
            focus: "Songs around campfires."
          },
          {
            keyword: "found-family",
            note: "Trust builds through shared peril.",
            focus: "Gift exchanges after each milestone."
          },
          {
            keyword: "hope",
            note: "Hospitality keeps the quest possible.",
            focus: "Beorn and Rivendell interludes."
          }
        ]
      },
      {
        title: "The Fellowship of the Ring",
        synopsis:
          "Nine walkers carry the One Ring south while the shadow deepens.",
        publishedYear: 1954,
        genres: ["fantasy", "epic-fantasy"],
        preps: [
          {
            keyword: "found-family",
            note: "The Fellowship negotiates purpose.",
            focus: "Council of Elrond speeches."
          },
          {
            keyword: "war-ethics",
            note: "Mercy vs. expedience is debated often.",
            focus: "Frodo sparing Gollum retold by many voices."
          },
          {
            keyword: "prophecy",
            note: "Old songs foreshadow modern choices.",
            focus: "Lothlórien laments."
          }
        ]
      },
      {
        title: "The Two Towers",
        synopsis:
          "The broken Fellowship confronts Saruman, Rohan, and creeping despair.",
        publishedYear: 1954,
        genres: ["fantasy", "epic-fantasy"],
        preps: [
          {
            keyword: "war-ethics",
            note: "Helm's Deep sets the stakes for total war.",
            focus: "Captain speeches atop the wall."
          },
          {
            keyword: "hope",
            note: "Small lights pierce the darkness.",
            focus: "Sam describing the star over Mordor."
          },
          {
            keyword: "found-family",
            note: "Merry and Pippin root with the Ents.",
            focus: "Shared jokes in Fangorn."
          }
        ]
      },
      {
        title: "The Return of the King",
        synopsis:
          "The War of the Ring ends with sacrifice, coronation, and bittersweet departures.",
        publishedYear: 1955,
        genres: ["fantasy", "epic-fantasy"],
        preps: [
          {
            keyword: "prophecy",
            note: "Aragorn fulfills ancient oaths.",
            focus: "Paths of the Dead scenes."
          },
          {
            keyword: "grief",
            note: "The Scouring of the Shire reframes victory.",
            focus: "Return journey chapters."
          },
          {
            keyword: "hope",
            note: "Even endings make space for future gardens.",
            focus: "Sam's final sentences."
          }
        ]
      }
    ]
  },
  {
    author: "Jane Austen",
    books: [
      {
        title: "Pride and Prejudice",
        synopsis:
          "Elizabeth Bennet navigates class, reputation, and unexpected affection.",
        publishedYear: 1813,
        genres: ["literary-fiction", "historical-fiction", "romance"],
        preps: [
          {
            keyword: "class",
            note: "Every dance is a negotiation.",
            focus: "Netherfield vs. Meryton etiquette."
          },
          {
            keyword: "identity",
            note: "Self-perception shifts with each letter.",
            focus: "Darcy's first proposal and rewrite."
          },
          {
            keyword: "resilience",
            note: "Sisters support one another even when they disagree.",
            focus: "Conversations between Lizzy and Jane."
          }
        ]
      }
    ]
  },
  {
    author: "Charlotte Brontë",
    books: [
      {
        title: "Jane Eyre",
        synopsis:
          "An orphaned governess seeks dignity, love, and autonomy.",
        publishedYear: 1847,
        genres: ["literary-fiction", "historical-fiction", "romance"],
        preps: [
          {
            keyword: "identity",
            note: "Jane asserts worth despite poverty.",
            focus: "Her responses during Lowood punishments."
          },
          {
            keyword: "gender",
            note: "Marriage proposals double as power contracts.",
            focus: "Conversations with Rochester and St. John."
          },
          {
            keyword: "healing",
            note: "Jane rebuilds her boundaries repeatedly.",
            focus: "Return to the Moor House sisters."
          }
        ]
      }
    ]
  },
  {
    author: "Emily Brontë",
    books: [
      {
        title: "Wuthering Heights",
        synopsis:
          "Generational obsession consumes the Earnshaw and Linton families.",
        publishedYear: 1847,
        genres: ["literary-fiction", "historical-fiction"],
        preps: [
          {
            keyword: "grief",
            note: "Loss is romanticized until it destroys everyone.",
            focus: "Heathcliff's monologues to ghosts."
          },
          {
            keyword: "trauma",
            note: "Abuse cycles across generations.",
            focus: "Scenes narrated by Nelly that feel unreliable."
          },
          {
            keyword: "storytelling",
            note: "Narrators contest truth.",
            focus: "Lockwood's frame narrative."
          }
        ]
      }
    ]
  },
  {
    author: "Charles Dickens",
    books: [
      {
        title: "Great Expectations",
        synopsis:
          "Pip rises from the forge dreaming of gentility, only to learn the cost of snobbery.",
        publishedYear: 1861,
        genres: ["literary-fiction", "historical-fiction"],
        preps: [
          {
            keyword: "class",
            note: "Money warps gratitude.",
            focus: "Miss Havisham's performance lessons."
          },
          {
            keyword: "identity",
            note: "Pip reinvents himself repeatedly.",
            focus: "Letters between Pip and Joe."
          },
          {
            keyword: "storytelling",
            note: "Older Pip narrates younger Pip with regret.",
            focus: "Moments that mention alternative endings."
          }
        ]
      }
    ]
  },
  {
    author: "George Orwell",
    books: [
      {
        title: "1984",
        synopsis:
          "Winston Smith rebels against the surveillance state of Oceania.",
        publishedYear: 1949,
        genres: ["science-fiction", "dystopian"],
        preps: [
          {
            keyword: "authoritarianism",
            note: "Language and truth are weaponized.",
            focus: "Two Minutes Hate rituals."
          },
          {
            keyword: "surveillance",
            note: "Tele-screens never sleep.",
            focus: "Diary passages about blind spots."
          },
          {
            keyword: "rebellion",
            note: "Small acts of care become resistance.",
            focus: "Charrington shop visits."
          }
        ]
      }
    ]
  },
  {
    author: "Aldous Huxley",
    books: [
      {
        title: "Brave New World",
        synopsis:
          "Engineered citizens of the World State confront individuality.",
        publishedYear: 1932,
        genres: ["science-fiction", "dystopian"],
        preps: [
          {
            keyword: "authoritarianism",
            note: "Pleasure keeps factory schedules tight.",
            focus: "Hypnopaedia slogans."
          },
          {
            keyword: "technology",
            note: "Reproductive control underwrites the caste system.",
            focus: "Bokanovsky process tours."
          },
          {
            keyword: "identity",
            note: "Bernard and John wrestle with belonging.",
            focus: "Conversations in the Savage Reservation."
          }
        ]
      }
    ]
  },
  {
    author: "Ray Bradbury",
    books: [
      {
        title: "Fahrenheit 451",
        synopsis:
          "Fireman Guy Montag burns books until curiosity ignites dissent.",
        publishedYear: 1953,
        genres: ["science-fiction", "dystopian"],
        preps: [
          {
            keyword: "authoritarianism",
            note: "State media dictates emotional range.",
            focus: "Wall-sized TV parlors."
          },
          {
            keyword: "storytelling",
            note: "Memorizing texts keeps knowledge alive.",
            focus: "Conversations with Faber."
          },
          {
            keyword: "rebellion",
            note: "Montag rewires his definition of neighbor.",
            focus: "River escape sequence."
          }
        ]
      }
    ]
  },
  {
    author: "Margaret Atwood",
    books: [
      {
        title: "The Handmaid's Tale",
        synopsis:
          "In Gilead, women are conscripted as handmaids and Offred remembers life before the coup.",
        publishedYear: 1985,
        genres: ["science-fiction", "dystopian", "literary-fiction"],
        preps: [
          {
            keyword: "gender",
            note: "Rituals script bodily autonomy.",
            focus: "Ceremony descriptions."
          },
          {
            keyword: "authoritarianism",
            note: "Faith-based propaganda controls speech.",
            focus: "Aunt Lydia's lectures."
          },
          {
            keyword: "rebellion",
            note: "Small gestures signal solidarity.",
            focus: "Butter notes, Mayday whispers."
          }
        ]
      }
    ]
  },
  {
    author: "Toni Morrison",
    books: [
      {
        title: "Beloved",
        synopsis:
          "Haunted by the daughter she killed, Sethe must face memory, community, and love.",
        publishedYear: 1987,
        genres: ["literary-fiction", "historical-fiction"],
        preps: [
          {
            keyword: "memory",
            note: "Remembrance is both salve and wound.",
            focus: "Shifts between 124, Sweet Home, and the Clearing."
          },
          {
            keyword: "trauma",
            note: "Characters name unspeakable violence.",
            focus: "Rememory conversations."
          },
          {
            keyword: "healing",
            note: "Sisterhood creates room for restoration.",
            focus: "Communal exorcism scenes."
          }
        ]
      }
    ]
  },
  {
    author: "Ralph Ellison",
    books: [
      {
        title: "Invisible Man",
        synopsis:
          "A Black narrator traverses institutions that refuse to see him.",
        publishedYear: 1952,
        genres: ["literary-fiction"],
        preps: [
          {
            keyword: "identity",
            note: "Masks pile up chapter by chapter.",
            focus: "Brotherhood speeches."
          },
          {
            keyword: "class",
            note: "Labor disputes shape solidarity.",
            focus: "Paint factory sequences."
          },
          {
            keyword: "storytelling",
            note: "Framing in the underground underscores agency.",
            focus: "Prologue vs. epilogue voice."
          }
        ]
      }
    ]
  },
  {
    author: "Zora Neale Hurston",
    books: [
      {
        title: "Their Eyes Were Watching God",
        synopsis:
          "Janie Crawford recounts three marriages while seeking her own voice.",
        publishedYear: 1937,
        genres: ["literary-fiction", "historical-fiction"],
        preps: [
          {
            keyword: "identity",
            note: "Dialect and narration trace agency.",
            focus: "Conversations on the porch in Eatonville."
          },
          {
            keyword: "resilience",
            note: "Storms and gossip test Janie's resolve.",
            focus: "Scenes after the hurricane."
          },
          {
            keyword: "hope",
            note: "Storytelling becomes reclamation.",
            focus: "Frame narrative with Phoeby."
          }
        ]
      }
    ]
  },
  {
    author: "Chinua Achebe",
    books: [
      {
        title: "Things Fall Apart",
        synopsis:
          "Okonkwo's rise and fall parallels the arrival of British colonial rule in Umuofia.",
        publishedYear: 1958,
        genres: ["historical-fiction", "literary-fiction"],
        preps: [
          {
            keyword: "colonialism",
            note: "Cultural imposition fractures community.",
            focus: "Court messengers entering village assemblies."
          },
          {
            keyword: "gender",
            note: "Masculinity ideals drive tragedy.",
            focus: "Feast of the New Yam customs."
          },
          {
            keyword: "storytelling",
            note: "Proverbs document resistance.",
            focus: "Narrator as oral historian."
          }
        ]
      }
    ]
  },
  {
    author: "Alice Walker",
    books: [
      {
        title: "The Color Purple",
        synopsis:
          "Celie writes letters to God and her sister while reclaiming her life in the rural South.",
        publishedYear: 1982,
        genres: ["literary-fiction", "historical-fiction"],
        preps: [
          {
            keyword: "trauma",
            note: "Letters capture abuse and resilience.",
            focus: "Shifts from God to Nettie."
          },
          {
            keyword: "healing",
            note: "Friendship with Shug teaches self-love.",
            focus: "Sewing room scenes."
          },
          {
            keyword: "found-family",
            note: "Community redefines kinship.",
            focus: "Reunion arcs."
          }
        ]
      }
    ]
  },
  {
    author: "Madeline Miller",
    books: [
      {
        title: "The Song of Achilles",
        synopsis:
          "Patroclus narrates his bond with Achilles from childhood to Troy.",
        publishedYear: 2011,
        genres: ["fantasy", "myth-retelling", "literary-fiction"],
        preps: [
          {
            keyword: "myth",
            note: "Trojan canon retold through tenderness.",
            focus: "Training sequences with Chiron."
          },
          {
            keyword: "war-ethics",
            note: "Glory versus compassion defines Achilles.",
            focus: "Diplomatic pleas before battle."
          },
          {
            keyword: "grief",
            note: "The ending lingers on memorial acts.",
            focus: "Final plea to Thetis."
          }
        ]
      },
      {
        title: "Circe",
        synopsis:
          "The witch of Aiaia tells her own story of exile, craft, and motherhood.",
        publishedYear: 2018,
        genres: ["fantasy", "myth-retelling", "literary-fiction"],
        preps: [
          {
            keyword: "identity",
            note: "Circe rejects Olympian hierarchies.",
            focus: "Conversations with Hermes and Odysseus."
          },
          {
            keyword: "myth",
            note: "Familiar tales shift through her narration.",
            focus: "Potion-making scenes."
          },
          {
            keyword: "resilience",
            note: "Solitude transforms into purpose.",
            focus: "Scenes with Telegonus and Telemachus."
          }
        ]
      }
    ]
  },
  {
    author: "Pat Barker",
    books: [
      {
        title: "The Silence of the Girls",
        synopsis:
          "Briseis recounts the Trojan War from inside the Greek camp.",
        publishedYear: 2018,
        genres: ["historical-fiction", "myth-retelling", "literary-fiction"],
        preps: [
          {
            keyword: "myth",
            note: "Familiar heroics become horror.",
            focus: "Chants contrasting hero names."
          },
          {
            keyword: "trauma",
            note: "Captivity shapes every action.",
            focus: "Conversations with the other women."
          },
          {
            keyword: "gender",
            note: "Voice reclamation is the act of rebellion.",
            focus: "Narration shifts back to Patroclus then to Briseis."
          }
        ]
      }
    ]
  },
  {
    author: "Neil Gaiman",
    books: [
      {
        title: "American Gods",
        synopsis:
          "Shadow Moon escorts the trickster Mr. Wednesday across America as old gods battle newcomers.",
        publishedYear: 2001,
        genres: ["fantasy", "urban-fantasy", "literary-fiction"],
        preps: [
          {
            keyword: "myth",
            note: "Immigrant deities reinvent themselves.",
            focus: "Roadside attraction interludes."
          },
          {
            keyword: "migration",
            note: "Faith follows trade routes.",
            focus: "Coming-to-America vignettes."
          },
          {
            keyword: "found-family",
            note: "Shadow chooses who to protect.",
            focus: "Conversations with Sam Black Crow."
          }
        ]
      },
      {
        title: "Neverwhere",
        synopsis:
          "Richard Mayhew slips into London Below, a city of forgotten people and dangerous angels.",
        publishedYear: 1996,
        genres: ["fantasy", "urban-fantasy"],
        preps: [
          {
            keyword: "identity",
            note: "Being invisible becomes literal.",
            focus: "Moments with Door naming him 'a good man.'"
          },
          {
            keyword: "found-family",
            note: "Odd companions form a questing party.",
            focus: "Banters with the Marquis de Carabas."
          },
          {
            keyword: "myth",
            note: "Tube stations hide legends.",
            focus: "Earl's Court sequence."
          }
        ]
      }
    ]
  },
  {
    author: "Neil Gaiman & Terry Pratchett",
    books: [
      {
        title: "Good Omens",
        synopsis:
          "An angel and a demon team up to stop the apocalypse with help from a misplaced Antichrist.",
        publishedYear: 1990,
        genres: ["fantasy", "literary-fiction"],
        preps: [
          {
            keyword: "hope",
            note: "Friendship bends destiny.",
            focus: "Bookshop lunches."
          },
          {
            keyword: "prophecy",
            note: "Agnes Nutter's book rewrites expectations.",
            focus: "Footnotes around predictions."
          },
          {
            keyword: "found-family",
            note: "Them, the kids, choose their own path.",
            focus: "Chats under the Tadfield tree."
          }
        ]
      }
    ]
  },
  {
    author: "William Gibson",
    books: [
      {
        title: "Neuromancer",
        synopsis:
          "Case, a washed-up hacker, is hired for a final run inside cyberspace.",
        publishedYear: 1984,
        genres: ["science-fiction", "cyberpunk"],
        preps: [
          {
            keyword: "technology",
            note: "Cyberspace decks redefine presence.",
            focus: "Matrix immersion passages."
          },
          {
            keyword: "surveillance",
            note: "AI constructs track every avatar.",
            focus: "Wintermute negotiations."
          },
          {
            keyword: "class",
            note: "Sprawl elites commodify talent.",
            focus: "Contrast between Chiba and Freeside."
          }
        ]
      }
    ]
  },
  {
    author: "Neal Stephenson",
    books: [
      {
        title: "Snow Crash",
        synopsis:
          "Hiro Protagonist chases a virus that targets both brains and the Metaverse.",
        publishedYear: 1992,
        genres: ["science-fiction", "cyberpunk"],
        preps: [
          {
            keyword: "language",
            note: "Sumerian lore underpins the virus.",
            focus: "L. Bob Rife broadcasts."
          },
          {
            keyword: "technology",
            note: "Metaverse economies foreshadow VR life.",
            focus: "Pizza-delivery chase."
          },
          {
            keyword: "authoritarianism",
            note: "Franchise states regulate freedom.",
            focus: "Citizen agreements in burbclaves."
          }
        ]
      }
    ]
  },
  {
    author: "Joe Haldeman",
    books: [
      {
        title: "The Forever War",
        synopsis:
          "William Mandella fights an interstellar war where relativity disconnects him from home.",
        publishedYear: 1974,
        genres: ["science-fiction", "military-sf"],
        preps: [
          {
            keyword: "war-ethics",
            note: "Orders lag centuries behind reality.",
            focus: "Battle briefings with time dilation stats."
          },
          {
            keyword: "time",
            note: "Each deployment leaps decades.",
            focus: "Homecoming chapters."
          },
          {
            keyword: "trauma",
            note: "Isolation compounds with every jump.",
            focus: "Mandella's journals."
          }
        ]
      }
    ]
  },
  {
    author: "Isaac Asimov",
    books: [
      {
        title: "Foundation",
        synopsis:
          "Hari Seldon's psychohistory seeds a plan to shorten the coming dark age.",
        publishedYear: 1951,
        genres: ["science-fiction", "political-thriller"],
        preps: [
          {
            keyword: "storytelling",
            note: "Encyclopedists curate myth as strategy.",
            focus: "Seldon Crisis recordings."
          },
          {
            keyword: "political-intrigue",
            note: "Trade and religion become soft power.",
            focus: "Terminus council debates."
          },
          {
            keyword: "hope",
            note: "Science becomes a beacon amid collapse.",
            focus: "Foundation propaganda pieces."
          }
        ]
      },
      {
        title: "Foundation and Empire",
        synopsis:
          "The Foundation confronts a warlord and the unpredictable Mule.",
        publishedYear: 1952,
        genres: ["science-fiction", "political-thriller"],
        preps: [
          {
            keyword: "authoritarianism",
            note: "The Mule rewrites loyalty through emotion.",
            focus: "Bayta and Toran conversations."
          },
          {
            keyword: "rebellion",
            note: "Resistance cells rely on intuition, not math.",
            focus: "Meetings with Magnifico."
          },
          {
            keyword: "hope",
            note: "Second Foundation whispers promise another layer.",
            focus: "Final pages hinting at telepaths."
          }
        ]
      },
      {
        title: "Second Foundation",
        synopsis:
          "Searches for the hidden Second Foundation pit mentalics against ambition.",
        publishedYear: 1953,
        genres: ["science-fiction", "political-thriller"],
        preps: [
          {
            keyword: "surveillance",
            note: "Mind readers escalate the arms race.",
            focus: "Arcadia Darell scenes."
          },
          {
            keyword: "political-intrigue",
            note: "Planets gamble to host Seldon's heirs.",
            focus: "Council hearings on Trantor."
          },
          {
            keyword: "identity",
            note: "What counts as free will?",
            focus: "Speakers' debates."
          }
        ]
      }
    ]
  },
  {
    author: "Dan Simmons",
    books: [
      {
        title: "Hyperion",
        synopsis:
          "Seven pilgrims travel to the Time Tombs, each sharing tales of the Shrike.",
        publishedYear: 1989,
        genres: ["science-fiction", "philosophical-sf"],
        preps: [
          {
            keyword: "storytelling",
            note: "Canterbury structure frames mystery.",
            focus: "Each pilgrim's confession."
          },
          {
            keyword: "religion",
            note: "Shrike worship complicates motives.",
            focus: "Bikura sect scenes."
          },
          {
            keyword: "war-ethics",
            note: "Hegemony vs. Ousters sets cosmic stakes.",
            focus: "Force projection debates."
          }
        ]
      },
      {
        title: "The Fall of Hyperion",
        synopsis:
          "War erupts while AI factions debate humanity's fate.",
        publishedYear: 1990,
        genres: ["science-fiction", "philosophical-sf"],
        preps: [
          {
            keyword: "technology",
            note: "The TechnoCore hides dark agendas.",
            focus: "John Keats cybrid dreamscapes."
          },
          {
            keyword: "religion",
            note: "Catholic, AI, and poet visions collide.",
            focus: "Father de Soya sequences."
          },
          {
            keyword: "hope",
            note: "Choices on Hyperion ripple to the Web.",
            focus: "Reunions near the Time Tombs."
          }
        ]
      }
    ]
  },
  {
    author: "Carl Sagan",
    books: [
      {
        title: "Contact",
        synopsis:
          "SETI scientist Ellie Arroway decodes a message leading to an interstellar meeting.",
        publishedYear: 1985,
        genres: ["science-fiction", "speculative-nonfiction"],
        preps: [
          {
            keyword: "technology",
            note: "Engineering feats require global cooperation.",
            focus: "Machine construction logs."
          },
          {
            keyword: "religion",
            note: "Faith leaders respond to proof of life.",
            focus: "Ellie vs. Palmer debates."
          },
          {
            keyword: "hope",
            note: "Curiosity becomes diplomacy.",
            focus: "Primer delivered post-journey."
          }
        ]
      }
    ]
  },
  {
    author: "Stanislaw Lem",
    books: [
      {
        title: "Solaris",
        synopsis:
          "Psychologist Kris Kelvin confronts a sentient ocean that manifests memories.",
        publishedYear: 1961,
        genres: ["science-fiction", "philosophical-sf"],
        preps: [
          {
            keyword: "memory",
            note: "Visitors expose unresolved guilt.",
            focus: "Hari's appearances."
          },
          {
            keyword: "technology",
            note: "Scientific observation fails to decode Solaris.",
            focus: "Library of futile explanations."
          },
          {
            keyword: "trauma",
            note: "Grief becomes corporeal.",
            focus: "Kelvin's internal debates."
          }
        ]
      }
    ]
  },
  {
    author: "R.F. Kuang",
    books: [
      {
        title: "The Poppy War",
        synopsis:
          "Rin rises from poverty to the Sinegard Academy, unlocking shamanic power amid genocidal war.",
        publishedYear: 2018,
        genres: ["fantasy", "historical-fiction"],
        preps: [
          {
            keyword: "war-ethics",
            note: "Each battle decision scars Rin.",
            focus: "Golyn Niis aftermath."
          },
          {
            keyword: "class",
            note: "Sinegard tuition mirrors empire.",
            focus: "Academy hazing rituals."
          },
          {
            keyword: "trauma",
            note: "Gods demand personal cost.",
            focus: "Opium visions."
          }
        ]
      },
      {
        title: "Babel",
        synopsis:
          "Robin Swift studies translation magic at Oxford, confronting colonial extraction.",
        publishedYear: 2022,
        genres: ["fantasy", "historical-fiction", "literary-fiction"],
        preps: [
          {
            keyword: "language",
            note: "Silver bars run on semantic gaps.",
            focus: "Classroom exercises with etymologies."
          },
          {
            keyword: "colonialism",
            note: "Empire steals language and labor.",
            focus: "Hermes Society debates."
          },
          {
            keyword: "rebellion",
            note: "Students choose sabotage over scholarship.",
            focus: "Tower occupation scenes."
          }
        ]
      }
    ]
  },
  {
    author: "Rebecca Roanhorse",
    books: [
      {
        title: "Black Sun",
        synopsis:
          "Prophecy, politics, and skyships collide in a pre-Columbian inspired epic.",
        publishedYear: 2020,
        genres: ["fantasy", "epic-fantasy"],
        preps: [
          {
            keyword: "myth",
            note: "Celestial omens structure each POV.",
            focus: "Countdown to convergence."
          },
          {
            keyword: "prophecy",
            note: "Naranpa and Serapio embody opposing destinies.",
            focus: "Hawk vs. Crow rituals."
          },
          {
            keyword: "found-family",
            note: "Ship crews and clan houses define loyalty.",
            focus: "Scenes aboard the Crow's ship."
          }
        ]
      }
    ]
  },
  {
    author: "Suzanne Collins",
    books: [
      {
        title: "The Hunger Games",
        synopsis:
          "Katniss volunteers to save her sister and becomes the spark of rebellion.",
        publishedYear: 2008,
        genres: ["science-fiction", "dystopian", "young-adult"],
        preps: [
          {
            keyword: "authoritarianism",
            note: "The Capitol televises punishment.",
            focus: "Reaping ceremony."
          },
          {
            keyword: "rebellion",
            note: "Mockingjay symbolism spreads quietly.",
            focus: "Rue partnership."
          },
          {
            keyword: "trauma",
            note: "Survival tactics become coping mechanisms.",
            focus: "Peeta's camouflage scene."
          }
        ]
      },
      {
        title: "Catching Fire",
        synopsis:
          "Victor tour unrest leads to another arena and open revolt.",
        publishedYear: 2009,
        genres: ["science-fiction", "dystopian", "young-adult"],
        preps: [
          {
            keyword: "authoritarianism",
            note: "Peacekeepers escalate violence.",
            focus: "Whipping of Gale."
          },
          {
            keyword: "found-family",
            note: "Allies form mid-arena.",
            focus: "Clock arena alliances."
          },
          {
            keyword: "rebellion",
            note: "Mockingjay role becomes official.",
            focus: "Dress revealing wings."
          }
        ]
      },
      {
        title: "Mockingjay",
        synopsis:
          "District 13 wages total war while Katniss becomes the face of liberation.",
        publishedYear: 2010,
        genres: ["science-fiction", "dystopian", "young-adult"],
        preps: [
          {
            keyword: "war-ethics",
            note: "Propaganda films are as deadly as bombs.",
            focus: "Propo filming schedules."
          },
          {
            keyword: "trauma",
            note: "PTSD shapes every decision.",
            focus: "Katniss's medical chart notes."
          },
          {
            keyword: "hope",
            note: "The ending imagines future children.",
            focus: "Epilogue field scene."
          }
        ]
      }
    ]
  },
  {
    author: "Jeff VanderMeer",
    books: [
      {
        title: "Annihilation",
        synopsis:
          "Four women enter Area X to document its impossible ecology.",
        publishedYear: 2014,
        genres: ["science-fiction", "horror", "cli-fi"],
        preps: [
          {
            keyword: "ecology",
            note: "Biosphere rewrites explorers.",
            focus: "Tower journal."
          },
          {
            keyword: "memory",
            note: "Identifiers replace names.",
            focus: "Biologist's flashbacks."
          },
          {
            keyword: "identity",
            note: "Selfhood blurs with environment.",
            focus: "Mirage scenes by the lighthouse."
          }
        ]
      }
    ]
  },
  {
    author: "Naomi Novik",
    books: [
      {
        title: "Spinning Silver",
        synopsis:
          "Three women bargain with fae, tsars, and winter itself to save their villages.",
        publishedYear: 2018,
        genres: ["fantasy", "myth-retelling", "historical-fiction"],
        preps: [
          {
            keyword: "class",
            note: "Money-lending unveils gendered power.",
            focus: "Ledgers Miryem keeps."
          },
          {
            keyword: "myth",
            note: "Rumpelstiltskin motifs are upended.",
            focus: "Staryk bargains."
          },
          {
            keyword: "found-family",
            note: "Alliances form across kingdoms.",
            focus: "Wedding negotiations."
          }
        ]
      }
    ]
  },
  {
    author: "Mary Shelley",
    books: [
      {
        title: "Frankenstein",
        synopsis:
          "Victor Frankenstein animates life and faces the consequences of abandonment.",
        publishedYear: 1818,
        genres: ["science-fiction", "horror", "literary-fiction"],
        preps: [
          {
            keyword: "technology",
            note: "Creation without care births tragedy.",
            focus: "Lab descriptions."
          },
          {
            keyword: "identity",
            note: "The Creature seeks recognition.",
            focus: "Monologues in the Alps."
          },
          {
            keyword: "grief",
            note: "Victor narrates regret to Walton.",
            focus: "Frame letters."
          }
        ]
      }
    ]
  },
  {
    author: "Gabriel García Márquez",
    books: [
      {
        title: "One Hundred Years of Solitude",
        synopsis:
          "The Buendía family saga unfolds in magical Macondo.",
        publishedYear: 1967,
        genres: ["literary-fiction", "magical-realism"],
        preps: [
          {
            keyword: "time",
            note: "Cycles repeat with minor shifts.",
            focus: "Family tree references."
          },
          {
            keyword: "storytelling",
            note: "Narrator blurs myth and fact.",
            focus: "Prophecies on parchments."
          },
          {
            keyword: "memory",
            note: "Plague of forgetfulness redefines community.",
            focus: "Labeling household objects."
          }
        ]
      }
    ]
  },
  {
    author: "Yaa Gyasi",
    books: [
      {
        title: "Homegoing",
        synopsis:
          "Two half sisters and their descendants experience divergent histories across Ghana and the United States.",
        publishedYear: 2016,
        genres: ["literary-fiction", "historical-fiction"],
        preps: [
          {
            keyword: "memory",
            note: "Chapters act as oral histories.",
            focus: "Naming conventions passed down."
          },
          {
            keyword: "migration",
            note: "Forced and voluntary movement shapes fate.",
            focus: "Scenes on the Middle Passage."
          },
          {
            keyword: "trauma",
            note: "Legacy of slavery is intergenerational.",
            focus: "Coal mining and convict labor chapters."
          }
        ]
      }
    ]
  },
  {
    author: "Viet Thanh Nguyen",
    books: [
      {
        title: "The Sympathizer",
        synopsis:
          "A communist double agent narrates life after the fall of Saigon.",
        publishedYear: 2015,
        genres: ["literary-fiction", "historical-fiction"],
        preps: [
          {
            keyword: "identity",
            note: "Dual loyalties fracture the narrator.",
            focus: "Movie set chapters."
          },
          {
            keyword: "war-ethics",
            note: "Revolutionary zeal collides with brutality.",
            focus: "Interrogation confession."
          },
          {
            keyword: "colonialism",
            note: "French, American, and Vietnamese power overlaps.",
            focus: "Reeducation camp dialogues."
          }
        ]
      }
    ]
  }
] as const;

const BASE_BOOKS: SeedBook[] = SERIES.flatMap((series) =>
  series.books.map((book) => ({
    ...book,
    author: series.author
  }))
);

const AUTHOR_BIOS: Record<string, string> = {
  "Arkady Martine": "Hugo-winning historian weaving Byzantine studies into space opera.",
  "N.K. Jemisin": "Three-time Hugo winner exploring power, geology, and liberation.",
  "Ursula K. Le Guin": "Grandmaster of speculative fiction balancing anthropology with imagination.",
  "Frank Herbert": "Journalist-turned-novelist obsessed with ecology and power vacuums.",
  "Octavia Butler": "MacArthur Fellow centering Black futures, biology, and agency."
};

const SYSTEM_USER_EMAIL = "curator@bookprepper.com";
const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

async function main() {
  console.log("\"Seeding BookPrepper catalog\"");

  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS=0`;

  try {
    await prisma.$executeRawUnsafe("TRUNCATE TABLE `PrepVote`");
    await prisma.$executeRawUnsafe("TRUNCATE TABLE `PrepKeywordOnPrep`");
    await prisma.$executeRawUnsafe("TRUNCATE TABLE `BookPrep`");
    await prisma.$executeRawUnsafe("TRUNCATE TABLE `PrepSuggestion`");
    await prisma.$executeRawUnsafe("TRUNCATE TABLE `BookGenre`");
    await prisma.$executeRawUnsafe("TRUNCATE TABLE `Book`");
    await prisma.$executeRawUnsafe("TRUNCATE TABLE `Author`");
    await prisma.$executeRawUnsafe("TRUNCATE TABLE `Genre`");
    await prisma.$executeRawUnsafe("TRUNCATE TABLE `PrepKeyword`");
    await prisma.$executeRawUnsafe("TRUNCATE TABLE `BookSuggestion`");
    await prisma.$executeRawUnsafe("TRUNCATE TABLE `UserProfile`");
  } finally {
    await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS=1`;
  }

  const systemUser = await prisma.userProfile.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    update: {
      displayName: "BookPrepper Curator"
    },
    create: {
      email: SYSTEM_USER_EMAIL,
      displayName: "BookPrepper Curator",
      cognitoSub: "system-curator"
    }
  });

  const existingBookKeys = new Set(BASE_BOOKS.map((book) => buildBookKey(book.title, book.author)));
  const goodreadsBooks = await loadGoodreadsBooks(existingBookKeys);
  const books = [...BASE_BOOKS, ...goodreadsBooks];

  const authorRecords = new Map<string, string>();
  for (const authorName of new Set(books.map((book) => book.author))) {
    const slug = slugify(authorName);
    const author = await prisma.author.upsert({
      where: { slug },
      update: {
        name: authorName,
        bio: AUTHOR_BIOS[authorName] ?? null
      },
      create: {
        name: authorName,
        slug,
        bio: AUTHOR_BIOS[authorName] ?? null
      }
    });
    authorRecords.set(authorName, author.id);
  }

  const genreRecords = new Map<GenreSlug, string>();
  const usedGenres = new Set<GenreSlug>(books.flatMap((book) => book.genres));
  for (const genreSlug of usedGenres) {
    const definition = GENRE_CATALOG[genreSlug];
    if (!definition) {
      throw new Error(`Missing genre definition for ${genreSlug}`);
    }
    const genre = await prisma.genre.upsert({
      where: { slug: genreSlug },
      update: {
        name: definition.name,
        description: definition.description
      },
      create: {
        slug: genreSlug,
        name: definition.name,
        description: definition.description
      }
    });
    genreRecords.set(genreSlug, genre.id);
  }

  const keywordRecords = new Map<KeywordSlug, string>();
  for (const [slug, template] of Object.entries(KEYWORD_TEMPLATES) as Array<[KeywordSlug, KeywordTemplate]>) {
    const keyword = await prisma.prepKeyword.upsert({
      where: { slug },
      update: {
        name: template.name,
        description: template.description
      },
      create: {
        slug,
        name: template.name,
        description: template.description
      }
    });
    keywordRecords.set(slug, keyword.id);
  }

  for (const book of books) {
    const authorId = authorRecords.get(book.author);
    if (!authorId) {
      throw new Error(`Author missing for ${book.title}`);
    }

    const bookRecord = await prisma.book.upsert({
      where: { slug: slugify(book.title) },
      update: {
        title: book.title,
        synopsis: book.synopsis,
        publishedYear: book.publishedYear,
        authorId
      },
      create: {
        title: book.title,
        slug: slugify(book.title),
        synopsis: book.synopsis,
        publishedYear: book.publishedYear,
        authorId
      }
    });

    await prisma.bookGenre.deleteMany({ where: { bookId: bookRecord.id } });
    for (const genreSlug of book.genres) {
      const genreId = genreRecords.get(genreSlug);
      if (!genreId) {
        throw new Error(`Genre missing for slug ${genreSlug}`);
      }
      await prisma.bookGenre.create({
        data: {
          bookId: bookRecord.id,
          genreId
        }
      });
    }

    for (const prep of book.preps) {
      const template = KEYWORD_TEMPLATES[prep.keyword];
      if (!template) {
        throw new Error(`Missing template for keyword ${prep.keyword}`);
      }

      const summaryText = truncateText(template.summary(book.title, prep.note));
      const watchForText = truncateText(template.watchFor(prep.focus ?? prep.note));

      const bookPrep = await prisma.bookPrep.create({
        data: {
          bookId: bookRecord.id,
          heading: truncateText(prep.heading ?? template.heading, 120),
          summary: summaryText,
          watchFor: watchForText,
          colorHint: prep.color ?? template.colorHint,
          createdById: systemUser.id
        }
      });

      const keywordSlugs = new Set<KeywordSlug>([prep.keyword, ...(prep.extraKeywords ?? [])]);
      for (const keywordSlug of keywordSlugs) {
        const keywordId = keywordRecords.get(keywordSlug);
        if (!keywordId) {
          throw new Error(`Missing keyword reference ${keywordSlug}`);
        }
        await prisma.prepKeywordOnPrep.create({
          data: {
            prepId: bookPrep.id,
            keywordId
          }
        });
      }
    }
  }

  console.log(
    `"Seeded ${books.length} books with curated preps (${goodreadsBooks.length} Goodreads additions)"`
  );
}

main()
  .catch((err) => {
    console.error(`"Seed failed: ${(err as Error).message}"`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const AUTO_GENRE: GenreSlug = "literary-fiction";

async function loadGoodreadsBooks(existingBookKeys: Set<string>): Promise<SeedBook[]> {
  try {
    const overridePath = process.env.GOODREADS_CSV?.trim();
    const source = overridePath && overridePath.length > 0 ? overridePath : new URL("../../../tmp/goodreads_cleaned.csv", import.meta.url);
    const raw = await readFile(source, "utf-8");
    const rows = raw.split(/\r?\n/);

    while (rows.length > 0 && !rows[0]?.trim()) {
      rows.shift();
    }

    if (rows.length === 0) {
      return [];
    }

    const headerLine = rows.shift();
    if (!headerLine) {
      return [];
    }

    const headers = parseCsvLine(headerLine);
    if (headers.length === 0) {
      return [];
    }

    const normalizedHeaders = headers.map((header, index) =>
      (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim().toLowerCase()
    );
    const titleIdx = normalizedHeaders.indexOf("booktitle");
    const authorIdx = normalizedHeaders.indexOf("authorname");

    if (titleIdx === -1 || authorIdx === -1) {
      console.warn("\"Goodreads CSV missing bookTitle/authorName columns\"");
      return [];
    }

    const ratingIdx = normalizedHeaders.indexOf("average_rating");
    const ratingsCountIdx = normalizedHeaders.indexOf("num_ratings");
    const additions: SeedBook[] = [];

    for (const row of rows) {
      if (!row?.trim()) {
        continue;
      }

      const columns = parseCsvLine(row);
      const title = columns[titleIdx];
      const author = columns[authorIdx];

      if (!title || !author) {
        continue;
      }

      const key = buildBookKey(title, author);
      if (existingBookKeys.has(key)) {
        continue;
      }

      let averageRating: number | undefined;
      if (ratingIdx !== -1 && columns[ratingIdx]) {
        const parsed = Number.parseFloat(columns[ratingIdx]);
        averageRating = Number.isNaN(parsed) ? undefined : parsed;
      }

      let ratingsCount: number | undefined;
      if (ratingsCountIdx !== -1 && columns[ratingsCountIdx]) {
        const parsed = Number.parseInt(columns[ratingsCountIdx].replace(/,/g, ""), 10);
        ratingsCount = Number.isNaN(parsed) ? undefined : parsed;
      }

      additions.push({
        title,
        author,
        synopsis: buildGoodreadsSynopsis(title, averageRating, ratingsCount),
        genres: [AUTO_GENRE],
        preps: buildAutoPreps(title)
      });

      existingBookKeys.add(key);
    }

    return additions;
  } catch {
    console.warn("\"Goodreads CSV missing; skipping bulk import\"");
    return [];
  }
}

function buildGoodreadsSynopsis(title: string, averageRating?: number, ratingsCount?: number) {
  if (averageRating && ratingsCount) {
    return `Imported Goodreads catalog entry for ${title} (avg rating ${averageRating.toFixed(2)} from ${NUMBER_FORMATTER.format(
      ratingsCount
    )} readers). Community suggestions welcome.`;
  }

  if (averageRating) {
    return `Imported Goodreads catalog entry for ${title} (avg rating ${averageRating.toFixed(2)}). Community suggestions welcome.`;
  }

  return `Imported Goodreads catalog entry for ${title}. Community suggestions welcome.`;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  const sanitized = line.replace(/\r$/, "");

  for (let i = 0; i < sanitized.length; i++) {
    const char = sanitized[i];
    const nextChar = sanitized[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function buildBookKey(title: string, author: string) {
  return `${title.trim().toLowerCase()}|${author.trim().toLowerCase()}`;
}

function buildAutoPreps(title: string): SeedPrep[] {
  return [
    {
      keyword: "storytelling",
      note: `Track how ${title} frames its narration across chapters.`
    },
    {
      keyword: "resilience",
      note: `Watch how characters in ${title} adapt when the stakes rise.`
    }
  ];
}

function truncateText(value: string | null | undefined, max = 180) {
  if (!value) return value;
  return value.length > max ? `${value.slice(0, max - 1).trim()}…` : value;
}


