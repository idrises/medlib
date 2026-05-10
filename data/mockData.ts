export interface Journal {
  id: string;
  title: string;
  shortTitle: string;
  issn: string;
  description: string;
  coverColor: string;
  impactFactor: number;
  publisher: string;
  frequency: string;
}

export interface JournalIssue {
  id: string;
  journalId: string;
  volume: number;
  issue: number;
  year: number;
  month: string;
  coverImageUrl?: string;
  articleCount: number;
  publishedAt: number;
}

export interface Article {
  id: string;
  issueId: string;
  journalId: string;
  title: string;
  authors: string[];
  abstract: string;
  keywords: string[];
  pages: string;
  doi: string;
  hasVideo: boolean;
  videoId?: string;
  publishedAt: number;
}

export interface Book {
  id: string;
  title: string;
  authors: string[];
  editors: string[];
  publisher: string;
  year: number;
  isbn: string;
  description: string;
  coverColor: string;
  chapterCount: number;
  hasVideo: boolean;
  publishedAt: number;
  category: string;
}

export interface Chapter {
  id: string;
  bookId: string;
  title: string;
  authors: string[];
  chapterNumber: number;
  abstract: string;
  pages: string;
  hasVideo: boolean;
  videoIds: string[];
  publishedAt: number;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  duration: number;
  thumbnailColor: string;
  videoUrl: string;
  authors: string[];
  category: "book_video" | "article_video" | "videoset_video";
  relatedBookId?: string;
  relatedArticleId?: string;
  videoSetId?: string;
  publishedAt: number;
  viewCount: number;
  tags: string[];
}

export interface VideoSet {
  id: string;
  title: string;
  description: string;
  editors: string[];
  organizer: string;
  year: number;
  location: string;
  coverColor: string;
  videoCount: number;
  videoIds: string[];
  publishedAt: number;
  category: string;
  tags: string[];
}

export const JOURNALS: Journal[] = [
  {
    id: "j1",
    title: "Plastic & Reconstructive Surgery",
    shortTitle: "PRS",
    issn: "0032-1052",
    description: "The official medical journal of the American Society of Plastic Surgeons.",
    coverColor: "#0057B8",
    impactFactor: 4.2,
    publisher: "Wolters Kluwer",
    frequency: "Monthly",
  },
  {
    id: "j2",
    title: "Aesthetic Surgery Journal",
    shortTitle: "ASJ",
    issn: "1090-820X",
    description: "The official publication of the American Society for Aesthetic Plastic Surgery.",
    coverColor: "#8B5CF6",
    impactFactor: 5.1,
    publisher: "Oxford University Press",
    frequency: "Monthly",
  },
  {
    id: "j3",
    title: "Journal of Plastic Surgery and Hand Surgery",
    shortTitle: "JPSHS",
    issn: "2000-656X",
    description: "Scandinavian journal covering plastic surgery and hand surgery advances.",
    coverColor: "#059669",
    impactFactor: 1.8,
    publisher: "Taylor & Francis",
    frequency: "Bimonthly",
  },
  {
    id: "j4",
    title: "Annals of Plastic Surgery",
    shortTitle: "APS",
    issn: "0148-7043",
    description: "Peer-reviewed journal covering all aspects of plastic and reconstructive surgery.",
    coverColor: "#DC2626",
    impactFactor: 2.3,
    publisher: "Wolters Kluwer",
    frequency: "Monthly",
  },
  {
    id: "j5",
    title: "European Journal of Plastic Surgery",
    shortTitle: "EJPS",
    issn: "0930-343X",
    description: "Official journal of the European Association of Plastic Surgeons.",
    coverColor: "#D97706",
    impactFactor: 1.6,
    publisher: "Springer",
    frequency: "Bimonthly",
  },
];

export const JOURNAL_ISSUES: JournalIssue[] = [
  { id: "ji1", journalId: "j1", volume: 153, issue: 1, year: 2024, month: "January", articleCount: 18, publishedAt: Date.now() - 86400000 * 5 },
  { id: "ji2", journalId: "j1", volume: 152, issue: 6, year: 2023, month: "December", articleCount: 22, publishedAt: Date.now() - 86400000 * 35 },
  { id: "ji3", journalId: "j1", volume: 152, issue: 5, year: 2023, month: "November", articleCount: 20, publishedAt: Date.now() - 86400000 * 65 },
  { id: "ji4", journalId: "j1", volume: 152, issue: 4, year: 2023, month: "October", articleCount: 19, publishedAt: Date.now() - 86400000 * 95 },
  { id: "ji5", journalId: "j1", volume: 152, issue: 3, year: 2023, month: "September", articleCount: 21, publishedAt: Date.now() - 86400000 * 125 },
  { id: "ji6", journalId: "j2", volume: 44, issue: 1, year: 2024, month: "January", articleCount: 15, publishedAt: Date.now() - 86400000 * 7 },
  { id: "ji7", journalId: "j2", volume: 43, issue: 12, year: 2023, month: "December", articleCount: 17, publishedAt: Date.now() - 86400000 * 37 },
  { id: "ji8", journalId: "j2", volume: 43, issue: 11, year: 2023, month: "November", articleCount: 16, publishedAt: Date.now() - 86400000 * 67 },
  { id: "ji9", journalId: "j3", volume: 58, issue: 1, year: 2024, month: "February", articleCount: 12, publishedAt: Date.now() - 86400000 * 10 },
  { id: "ji10", journalId: "j4", volume: 92, issue: 1, year: 2024, month: "January", articleCount: 20, publishedAt: Date.now() - 86400000 * 3 },
  { id: "ji11", journalId: "j5", volume: 47, issue: 1, year: 2024, month: "February", articleCount: 10, publishedAt: Date.now() - 86400000 * 8 },
];

export const ARTICLES: Article[] = [
  {
    id: "a1",
    issueId: "ji1",
    journalId: "j1",
    title: "Long-term Outcomes of Primary Rhinoplasty: A 10-Year Follow-Up Study",
    authors: ["Smith JA", "Johnson KL", "Williams MR"],
    abstract: "This comprehensive study evaluates the long-term aesthetic and functional outcomes of primary rhinoplasty in 500 patients over a 10-year period. Results demonstrate significant improvement in both objective measurements and patient-reported satisfaction scores.",
    keywords: ["rhinoplasty", "outcomes", "long-term", "nasal surgery"],
    pages: "12-24",
    doi: "10.1097/PRS.0000000000011001",
    hasVideo: true,
    videoId: "v1",
    publishedAt: Date.now() - 86400000 * 5,
  },
  {
    id: "a2",
    issueId: "ji1",
    journalId: "j1",
    title: "Advances in Autologous Fat Transfer for Breast Augmentation",
    authors: ["Garcia EM", "Chen HL", "Patel RS"],
    abstract: "A systematic review of fat grafting techniques for breast augmentation, including volumetric analysis, retention rates, and safety profiles across 1,200 procedures.",
    keywords: ["fat transfer", "breast augmentation", "lipofilling", "autologous"],
    pages: "25-38",
    doi: "10.1097/PRS.0000000000011002",
    hasVideo: false,
    publishedAt: Date.now() - 86400000 * 5,
  },
  {
    id: "a3",
    issueId: "ji1",
    journalId: "j1",
    title: "Minimally Invasive Facelift Techniques: Comparative Analysis",
    authors: ["Brown TP", "Davis SE"],
    abstract: "Comparative analysis of six minimally invasive facelift techniques with 3-year follow-up data showing patient satisfaction, complication rates, and longevity of results.",
    keywords: ["facelift", "SMAS", "minimally invasive", "facial rejuvenation"],
    pages: "39-52",
    doi: "10.1097/PRS.0000000000011003",
    hasVideo: true,
    videoId: "v2",
    publishedAt: Date.now() - 86400000 * 5,
  },
  {
    id: "a4",
    issueId: "ji6",
    journalId: "j2",
    title: "Patient-Reported Outcomes After Abdominoplasty: A Multicenter Study",
    authors: ["Lee MK", "Thompson AJ", "Rodriguez LM"],
    abstract: "Prospective multicenter study evaluating quality of life and satisfaction outcomes in patients undergoing abdominoplasty, with 12-month follow-up.",
    keywords: ["abdominoplasty", "tummy tuck", "quality of life", "patient satisfaction"],
    pages: "5-18",
    doi: "10.1093/asj/sjad001",
    hasVideo: false,
    publishedAt: Date.now() - 86400000 * 7,
  },
  {
    id: "a5",
    issueId: "ji6",
    journalId: "j2",
    title: "Eyelid Surgery: Current Techniques and Innovations in Blepharoplasty",
    authors: ["White EK", "Anderson PM"],
    abstract: "Review of current blepharoplasty techniques including transconjunctival approach, fat repositioning, and skin resurfacing adjuncts for optimal periorbital rejuvenation.",
    keywords: ["blepharoplasty", "eyelid surgery", "periorbital", "rejuvenation"],
    pages: "19-31",
    doi: "10.1093/asj/sjad002",
    hasVideo: true,
    videoId: "v3",
    publishedAt: Date.now() - 86400000 * 7,
  },
  {
    id: "a6",
    issueId: "ji10",
    journalId: "j4",
    title: "Reconstruction After Breast Cancer: Timing and Outcomes",
    authors: ["Martinez CP", "Wilson KR", "Taylor NB"],
    abstract: "Analysis of immediate versus delayed breast reconstruction following mastectomy, evaluating oncologic safety, aesthetic outcomes, and patient wellbeing.",
    keywords: ["breast reconstruction", "mastectomy", "oncoplastic", "timing"],
    pages: "8-22",
    doi: "10.1097/SAP.0000000000003501",
    hasVideo: false,
    publishedAt: Date.now() - 86400000 * 3,
  },
];

export const BOOKS: Book[] = [
  {
    id: "b1",
    title: "Rhinoplasty: Art and Science",
    authors: ["Rollin K. Daniel", "Bahman Guyuron"],
    editors: ["Rollin K. Daniel"],
    publisher: "Elsevier",
    year: 2023,
    isbn: "978-0-323-69857-3",
    description: "The definitive comprehensive guide to rhinoplasty covering surgical anatomy, aesthetic principles, and surgical techniques with over 2,000 clinical photographs.",
    coverColor: "#0057B8",
    chapterCount: 32,
    hasVideo: true,
    publishedAt: Date.now() - 86400000 * 30,
    category: "Rhinoplasty",
  },
  {
    id: "b2",
    title: "Aesthetic Surgery of the Face",
    authors: ["Bryan Mendelson", "Rod Rohrich"],
    editors: ["Bryan Mendelson"],
    publisher: "Thieme",
    year: 2023,
    isbn: "978-3-13-241687-5",
    description: "Comprehensive atlas of facial aesthetic surgery covering facelift, brow lift, blepharoplasty, and ancillary procedures with detailed surgical illustrations.",
    coverColor: "#8B5CF6",
    chapterCount: 28,
    hasVideo: true,
    publishedAt: Date.now() - 86400000 * 20,
    category: "Facial Surgery",
  },
  {
    id: "b3",
    title: "Breast Augmentation: Principles and Practice",
    authors: ["Scott Spear", "Peter Alderman"],
    editors: ["Scott Spear"],
    publisher: "Springer",
    year: 2022,
    isbn: "978-3-030-87654-2",
    description: "Evidence-based approach to breast augmentation surgery covering implant selection, surgical planning, operative techniques, and complication management.",
    coverColor: "#DC2626",
    chapterCount: 24,
    hasVideo: false,
    publishedAt: Date.now() - 86400000 * 60,
    category: "Breast Surgery",
  },
  {
    id: "b4",
    title: "Body Contouring Surgery",
    authors: ["Jeffrey Kenkel", "William Adams"],
    editors: ["Jeffrey Kenkel"],
    publisher: "Quality Medical Publishing",
    year: 2023,
    isbn: "978-1-57626-394-7",
    description: "Complete guide to body contouring procedures including liposuction, abdominoplasty, brachioplasty, and massive weight loss surgery.",
    coverColor: "#059669",
    chapterCount: 22,
    hasVideo: true,
    publishedAt: Date.now() - 86400000 * 10,
    category: "Body Contouring",
  },
  {
    id: "b5",
    title: "Hand Surgery: A Core Curriculum",
    authors: ["Kevin Chung", "James Chang"],
    editors: ["Kevin Chung"],
    publisher: "Elsevier",
    year: 2022,
    isbn: "978-0-323-71428-7",
    description: "Core curriculum for hand surgery training covering anatomy, trauma, reconstruction, congenital anomalies, and nerve surgery.",
    coverColor: "#D97706",
    chapterCount: 30,
    hasVideo: false,
    publishedAt: Date.now() - 86400000 * 90,
    category: "Hand Surgery",
  },
  {
    id: "b6",
    title: "Microsurgery: Global Principles",
    authors: ["David Chang", "Hung-Chi Chen"],
    editors: ["David Chang"],
    publisher: "Thieme",
    year: 2023,
    isbn: "978-3-13-256789-1",
    description: "Global principles of microsurgery for plastic and reconstructive surgeons covering free flap reconstruction, lymphatic surgery, and vascular repair.",
    coverColor: "#7C3AED",
    chapterCount: 26,
    hasVideo: true,
    publishedAt: Date.now() - 86400000 * 15,
    category: "Microsurgery",
  },
];

export const CHAPTERS: Chapter[] = [
  {
    id: "ch1", bookId: "b1", chapterNumber: 1, title: "Surgical Anatomy of the Nose",
    authors: ["Rollin K. Daniel"], abstract: "Comprehensive anatomical review of nasal structures relevant to rhinoplasty including osseocartilagenous framework, skin-soft tissue envelope, and internal nasal lining.",
    pages: "1-45", hasVideo: true, videoIds: ["bv1", "bv2"], publishedAt: Date.now() - 86400000 * 30,
  },
  {
    id: "ch2", bookId: "b1", chapterNumber: 2, title: "Aesthetic Analysis and Surgical Planning",
    authors: ["Bahman Guyuron"], abstract: "Systematic approach to rhinoplasty analysis using standardized photography, measurements, and computer imaging for surgical planning.",
    pages: "46-89", hasVideo: true, videoIds: ["bv3"], publishedAt: Date.now() - 86400000 * 30,
  },
  {
    id: "ch3", bookId: "b1", chapterNumber: 3, title: "Open Rhinoplasty: Approach and Exposure",
    authors: ["Rollin K. Daniel"], abstract: "Step-by-step guide to the open rhinoplasty approach including incision design, tissue dissection, and anatomic exposure.",
    pages: "90-132", hasVideo: true, videoIds: ["bv4", "bv5"], publishedAt: Date.now() - 86400000 * 30,
  },
  {
    id: "ch4", bookId: "b1", chapterNumber: 4, title: "Tip Refinement Techniques",
    authors: ["Jack Gunter"], abstract: "Comprehensive review of tip refinement maneuvers including suture techniques, grafts, and cartilage modification for predictable tip definition.",
    pages: "133-178", hasVideo: false, videoIds: [], publishedAt: Date.now() - 86400000 * 30,
  },
  {
    id: "ch5", bookId: "b1", chapterNumber: 5, title: "Dorsal Hump Reduction",
    authors: ["Ronald Gruber"], abstract: "Techniques for dorsal reduction including component reduction, let-down procedures, and management of dorsal aesthetics.",
    pages: "179-215", hasVideo: true, videoIds: ["bv6"], publishedAt: Date.now() - 86400000 * 30,
  },
  {
    id: "ch6", bookId: "b2", chapterNumber: 1, title: "Anatomy of the Aging Face",
    authors: ["Bryan Mendelson"], abstract: "Detailed review of facial aging anatomy including fat compartments, ligament attenuation, skeletal changes, and skin changes.",
    pages: "1-38", hasVideo: false, videoIds: [], publishedAt: Date.now() - 86400000 * 20,
  },
  {
    id: "ch7", bookId: "b2", chapterNumber: 2, title: "Deep Plane Facelift",
    authors: ["Sam Hamra"], abstract: "Comprehensive guide to the deep plane facelift technique addressing facial aging at the anatomic level with long-lasting results.",
    pages: "39-85", hasVideo: true, videoIds: ["bv7", "bv8"], publishedAt: Date.now() - 86400000 * 20,
  },
  {
    id: "ch8", bookId: "b4", chapterNumber: 1, title: "Liposuction: Techniques and Safety",
    authors: ["Jeffrey Kenkel"], abstract: "Evidence-based review of liposuction techniques including tumescent, ultrasound-assisted, and laser-assisted methods with safety protocols.",
    pages: "1-52", hasVideo: true, videoIds: ["bv9"], publishedAt: Date.now() - 86400000 * 10,
  },
  {
    id: "ch9", bookId: "b6", chapterNumber: 1, title: "Microsurgical Principles and Technique",
    authors: ["David Chang"], abstract: "Fundamental principles of microsurgery including vessel anastomosis technique, magnification, instrumentation, and vascular physics.",
    pages: "1-40", hasVideo: true, videoIds: ["bv10", "bv11"], publishedAt: Date.now() - 86400000 * 15,
  },
];

export const VIDEOS: Video[] = [
  {
    id: "bv1", title: "Nasal Anatomy for Rhinoplasty Surgeons", description: "In-depth cadaveric dissection demonstrating nasal anatomy crucial for rhinoplasty", duration: 2340, thumbnailColor: "#0057B8",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    authors: ["Rollin K. Daniel"], category: "book_video", relatedBookId: "b1", publishedAt: Date.now() - 86400000 * 30, viewCount: 1240, tags: ["anatomy", "rhinoplasty", "cadaver"],
  },
  {
    id: "bv2", title: "Nasal Skin Analysis and Planning", description: "Systematic approach to evaluating nasal skin characteristics for surgical planning", duration: 1680, thumbnailColor: "#0057B8",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    authors: ["Bahman Guyuron"], category: "book_video", relatedBookId: "b1", publishedAt: Date.now() - 86400000 * 30, viewCount: 890, tags: ["skin analysis", "rhinoplasty"],
  },
  {
    id: "bv3", title: "Computer Imaging for Rhinoplasty", description: "How to use digital imaging tools for pre-operative patient consultation", duration: 1920, thumbnailColor: "#0057B8",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    authors: ["Bahman Guyuron"], category: "book_video", relatedBookId: "b1", publishedAt: Date.now() - 86400000 * 30, viewCount: 1560, tags: ["imaging", "consultation", "rhinoplasty"],
  },
  {
    id: "bv4", title: "Open Rhinoplasty: Step-by-Step", description: "Complete operative video of open rhinoplasty technique", duration: 3600, thumbnailColor: "#0057B8",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    authors: ["Rollin K. Daniel"], category: "book_video", relatedBookId: "b1", publishedAt: Date.now() - 86400000 * 28, viewCount: 3421, tags: ["operative", "open rhinoplasty"],
  },
  {
    id: "bv5", title: "Incision Design and Tissue Handling", description: "Detailed instruction on transcolumellar incision placement and tissue dissection", duration: 1440, thumbnailColor: "#0057B8",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    authors: ["Rollin K. Daniel"], category: "book_video", relatedBookId: "b1", publishedAt: Date.now() - 86400000 * 28, viewCount: 976, tags: ["incision", "technique"],
  },
  {
    id: "bv6", title: "Dorsal Reduction: Component Approach", description: "Live surgery demonstrating component dorsal reduction with osteotomies", duration: 2760, thumbnailColor: "#0057B8",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    authors: ["Ronald Gruber"], category: "book_video", relatedBookId: "b1", publishedAt: Date.now() - 86400000 * 25, viewCount: 2145, tags: ["dorsum", "osteotomy", "reduction"],
  },
  {
    id: "bv7", title: "Deep Plane Anatomy and Dissection", description: "Anatomic dissection of facial planes relevant to deep plane facelift", duration: 2160, thumbnailColor: "#8B5CF6",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    authors: ["Sam Hamra"], category: "book_video", relatedBookId: "b2", publishedAt: Date.now() - 86400000 * 20, viewCount: 1876, tags: ["deep plane", "anatomy", "facelift"],
  },
  {
    id: "bv8", title: "Deep Plane Facelift: Operative Technique", description: "Complete operative deep plane facelift with extensive patient follow-up", duration: 4200, thumbnailColor: "#8B5CF6",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    authors: ["Sam Hamra"], category: "book_video", relatedBookId: "b2", publishedAt: Date.now() - 86400000 * 20, viewCount: 4231, tags: ["operative", "deep plane", "facelift"],
  },
  {
    id: "bv9", title: "Power-Assisted Liposuction Technique", description: "Demonstration of power-assisted liposuction with safety pearls", duration: 1980, thumbnailColor: "#059669",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    authors: ["Jeffrey Kenkel"], category: "book_video", relatedBookId: "b4", publishedAt: Date.now() - 86400000 * 10, viewCount: 1321, tags: ["liposuction", "technique", "body contouring"],
  },
  {
    id: "bv10", title: "Microsurgical Vessel Anastomosis", description: "Detailed instruction in microsurgical anastomosis under magnification", duration: 3120, thumbnailColor: "#7C3AED",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    authors: ["David Chang"], category: "book_video", relatedBookId: "b6", publishedAt: Date.now() - 86400000 * 15, viewCount: 2654, tags: ["microsurgery", "anastomosis", "technique"],
  },
  {
    id: "bv11", title: "Free Flap Selection and Planning", description: "Decision-making process for free flap selection in complex reconstruction", duration: 2400, thumbnailColor: "#7C3AED",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4",
    authors: ["David Chang", "Hung-Chi Chen"], category: "book_video", relatedBookId: "b6", publishedAt: Date.now() - 86400000 * 14, viewCount: 1987, tags: ["free flap", "reconstruction", "microsurgery"],
  },
  {
    id: "v1", title: "Rhinoplasty Outcomes Video Series", description: "Video supplement to the long-term rhinoplasty outcomes study", duration: 1560, thumbnailColor: "#0057B8",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
    authors: ["Smith JA", "Johnson KL"], category: "article_video", relatedArticleId: "a1", publishedAt: Date.now() - 86400000 * 5, viewCount: 432, tags: ["rhinoplasty", "outcomes"],
  },
  {
    id: "v2", title: "Minimally Invasive Facelift Techniques", description: "Operative video supplement showing six MACS lift techniques", duration: 2880, thumbnailColor: "#6D28D9",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
    authors: ["Brown TP", "Davis SE"], category: "article_video", relatedArticleId: "a3", publishedAt: Date.now() - 86400000 * 5, viewCount: 678, tags: ["facelift", "MACS", "minimally invasive"],
  },
  {
    id: "v3", title: "Transconjunctival Blepharoplasty", description: "Operative demonstration of transconjunctival lower blepharoplasty", duration: 2100, thumbnailColor: "#8B5CF6",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    authors: ["White EK"], category: "article_video", relatedArticleId: "a5", publishedAt: Date.now() - 86400000 * 7, viewCount: 521, tags: ["blepharoplasty", "eyelid", "operative"],
  },
];

export const VIDEO_SETS: VideoSet[] = [
  {
    id: "vs1",
    title: "European Rhinoplasty Summer Course 2024",
    description: "Comprehensive rhinoplasty course from Europe's leading plastic surgery education meeting featuring live surgeries, lectures, and panel discussions.",
    editors: ["Niki Antoniades", "Yves Saban"],
    organizer: "European Academy of Facial Plastic Surgery",
    year: 2024,
    location: "Athens, Greece",
    coverColor: "#0057B8",
    videoCount: 4,
    videoIds: ["vs1_v1", "vs1_v2", "vs1_v3", "vs1_v4"],
    publishedAt: Date.now() - 86400000 * 15,
    category: "Course",
    tags: ["rhinoplasty", "course", "europe", "2024"],
  },
  {
    id: "vs2",
    title: "ASAPS Annual Meeting 2024: Body Contouring",
    description: "Selected body contouring presentations from the American Society for Aesthetic Plastic Surgery Annual Meeting including liposuction, abdominoplasty, and body lift techniques.",
    editors: ["Rod Rohrich", "Alan Matarasso"],
    organizer: "American Society for Aesthetic Plastic Surgery",
    year: 2024,
    location: "Las Vegas, Nevada",
    coverColor: "#DC2626",
    videoCount: 3,
    videoIds: ["vs2_v1", "vs2_v2", "vs2_v3"],
    publishedAt: Date.now() - 86400000 * 25,
    category: "Meeting",
    tags: ["body contouring", "ASAPS", "annual meeting", "2024"],
  },
  {
    id: "vs3",
    title: "Microsurgery Master Class 2023",
    description: "Advanced microsurgery techniques including complex free flap reconstruction, lymphatic surgery, and vascular repair taught by world-renowned microsurgeons.",
    editors: ["David Chang", "Julie Spratt"],
    organizer: "American Society for Reconstructive Microsurgery",
    year: 2023,
    location: "San Francisco, California",
    coverColor: "#7C3AED",
    videoCount: 5,
    videoIds: ["vs3_v1", "vs3_v2", "vs3_v3", "vs3_v4", "vs3_v5"],
    publishedAt: Date.now() - 86400000 * 45,
    category: "Master Class",
    tags: ["microsurgery", "free flap", "reconstruction", "2023"],
  },
  {
    id: "vs4",
    title: "Breast Surgery Symposium 2024",
    description: "Comprehensive breast surgery symposium covering implant-based augmentation, fat grafting, mastopexy, and oncoplastic reconstruction with live case demonstrations.",
    editors: ["Scott Spear", "John Tebbetts"],
    organizer: "International Society of Aesthetic Plastic Surgery",
    year: 2024,
    location: "Paris, France",
    coverColor: "#EC4899",
    videoCount: 4,
    videoIds: ["vs4_v1", "vs4_v2", "vs4_v3", "vs4_v4"],
    publishedAt: Date.now() - 86400000 * 8,
    category: "Symposium",
    tags: ["breast surgery", "augmentation", "ISAPS", "2024"],
  },
];

export const VIDEO_SET_VIDEOS: Video[] = [
  {
    id: "vs1_v1", title: "Structural Rhinoplasty: Foundations", description: "Core principles of structural rhinoplasty approach with emphasis on maintaining nasal support", duration: 3600, thumbnailColor: "#0057B8",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    authors: ["Niki Antoniades"], category: "videoset_video", videoSetId: "vs1", publishedAt: Date.now() - 86400000 * 15, viewCount: 876, tags: ["rhinoplasty", "structural"],
  },
  {
    id: "vs1_v2", title: "Ethnic Rhinoplasty: Special Considerations", description: "Rhinoplasty in diverse ethnic populations: anatomic differences and surgical planning", duration: 2700, thumbnailColor: "#0057B8",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    authors: ["Yves Saban"], category: "videoset_video", videoSetId: "vs1", publishedAt: Date.now() - 86400000 * 15, viewCount: 1243, tags: ["ethnic rhinoplasty", "diversity"],
  },
  {
    id: "vs1_v3", title: "Live Surgery: Primary Rhinoplasty", description: "Unedited live surgery session with real-time commentary by faculty panel", duration: 5400, thumbnailColor: "#0057B8",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    authors: ["Niki Antoniades", "Yves Saban"], category: "videoset_video", videoSetId: "vs1", publishedAt: Date.now() - 86400000 * 14, viewCount: 4321, tags: ["live surgery", "primary rhinoplasty"],
  },
  {
    id: "vs1_v4", title: "Revision Rhinoplasty: Managing Complex Cases", description: "Approach to the challenging revision rhinoplasty patient including cartilage grafting strategies", duration: 4200, thumbnailColor: "#0057B8",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    authors: ["Yves Saban"], category: "videoset_video", videoSetId: "vs1", publishedAt: Date.now() - 86400000 * 14, viewCount: 3567, tags: ["revision rhinoplasty", "complex"],
  },
  {
    id: "vs2_v1", title: "High-Definition Liposuction Technique", description: "VASER-assisted high-definition liposculpture for athletic body contouring", duration: 3120, thumbnailColor: "#DC2626",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    authors: ["Rod Rohrich"], category: "videoset_video", videoSetId: "vs2", publishedAt: Date.now() - 86400000 * 25, viewCount: 2876, tags: ["HD liposuction", "VASER", "body contouring"],
  },
  {
    id: "vs2_v2", title: "Extended Abdominoplasty with Flank Liposuction", description: "Comprehensive abdominoplasty with circumferential liposuction for maximum body contouring result", duration: 4800, thumbnailColor: "#DC2626",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    authors: ["Alan Matarasso"], category: "videoset_video", videoSetId: "vs2", publishedAt: Date.now() - 86400000 * 24, viewCount: 2134, tags: ["abdominoplasty", "flank", "liposuction"],
  },
  {
    id: "vs2_v3", title: "Post-Bariatric Body Lift: Lower Body", description: "Belt lipectomy and lower body lift for massive weight loss patients", duration: 5400, thumbnailColor: "#DC2626",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    authors: ["Rod Rohrich"], category: "videoset_video", videoSetId: "vs2", publishedAt: Date.now() - 86400000 * 24, viewCount: 1654, tags: ["body lift", "bariatric", "MWL"],
  },
  {
    id: "vs3_v1", title: "DIEP Flap Breast Reconstruction", description: "Complete DIEP free flap harvest and breast reconstruction with microsurgical anastomosis", duration: 7200, thumbnailColor: "#7C3AED",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    authors: ["David Chang"], category: "videoset_video", videoSetId: "vs3", publishedAt: Date.now() - 86400000 * 45, viewCount: 5432, tags: ["DIEP flap", "breast reconstruction", "microsurgery"],
  },
  {
    id: "vs3_v2", title: "Anterolateral Thigh Flap: Harvest and Inset", description: "ALT flap harvesting technique and inset for head and neck reconstruction", duration: 5100, thumbnailColor: "#7C3AED",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    authors: ["Hung-Chi Chen"], category: "videoset_video", videoSetId: "vs3", publishedAt: Date.now() - 86400000 * 44, viewCount: 3876, tags: ["ALT flap", "head neck", "reconstruction"],
  },
  {
    id: "vs3_v3", title: "Lymphedema Surgery: LYMPHA Technique", description: "Lymphatic microsurgical preventive healing approach during axillary lymph node dissection", duration: 3600, thumbnailColor: "#7C3AED",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    authors: ["Julie Spratt"], category: "videoset_video", videoSetId: "vs3", publishedAt: Date.now() - 86400000 * 43, viewCount: 2341, tags: ["lymphedema", "lymphatic", "microsurgery"],
  },
  {
    id: "vs3_v4", title: "Supermicrosurgery: Lymphaticovenous Anastomosis", description: "Supermicrosurgical LVA for lymphedema treatment under ultra-high magnification", duration: 4320, thumbnailColor: "#7C3AED",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4",
    authors: ["David Chang"], category: "videoset_video", videoSetId: "vs3", publishedAt: Date.now() - 86400000 * 43, viewCount: 1987, tags: ["supermicrosurgery", "LVA", "lymphedema"],
  },
  {
    id: "vs3_v5", title: "Perforator Flap Selection: Decision Making", description: "Algorithm-based approach to perforator flap selection for various reconstructive challenges", duration: 2880, thumbnailColor: "#7C3AED",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
    authors: ["Hung-Chi Chen"], category: "videoset_video", videoSetId: "vs3", publishedAt: Date.now() - 86400000 * 42, viewCount: 2654, tags: ["perforator flap", "decision making"],
  },
  {
    id: "vs4_v1", title: "Anatomical Implant Selection and Planning", description: "Evidence-based approach to anatomical breast implant selection using dimensional planning", duration: 3000, thumbnailColor: "#EC4899",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
    authors: ["John Tebbetts"], category: "videoset_video", videoSetId: "vs4", publishedAt: Date.now() - 86400000 * 8, viewCount: 1432, tags: ["breast implant", "planning", "anatomical"],
  },
  {
    id: "vs4_v2", title: "Dual-Plane Breast Augmentation Technique", description: "Operative demonstration of dual-plane pocket dissection for optimal implant positioning", duration: 3840, thumbnailColor: "#EC4899",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    authors: ["Scott Spear"], category: "videoset_video", videoSetId: "vs4", publishedAt: Date.now() - 86400000 * 7, viewCount: 2876, tags: ["dual plane", "breast augmentation"],
  },
  {
    id: "vs4_v3", title: "Fat Grafting to the Breast: Technique and Safety", description: "Comprehensive fat grafting protocol for breast augmentation and reconstruction", duration: 2640, thumbnailColor: "#EC4899",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    authors: ["Scott Spear"], category: "videoset_video", videoSetId: "vs4", publishedAt: Date.now() - 86400000 * 7, viewCount: 2143, tags: ["fat grafting", "breast", "lipofilling"],
  },
  {
    id: "vs4_v4", title: "Implant Exchange and Revision Surgery", description: "Systematic approach to breast implant revision including capsulectomy and pocket change", duration: 4200, thumbnailColor: "#EC4899",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    authors: ["John Tebbetts"], category: "videoset_video", videoSetId: "vs4", publishedAt: Date.now() - 86400000 * 6, viewCount: 1765, tags: ["revision", "implant exchange", "capsulectomy"],
  },
];

export const ALL_VIDEOS = [...VIDEOS, ...VIDEO_SET_VIDEOS];

export function getVideoById(id: string): Video | undefined {
  return ALL_VIDEOS.find(v => v.id === id);
}

export function getChaptersByBookId(bookId: string): Chapter[] {
  return CHAPTERS.filter(c => c.bookId === bookId);
}

export function getArticlesByIssueId(issueId: string): Article[] {
  return ARTICLES.filter(a => a.issueId === issueId);
}

export function getIssuesByJournalId(journalId: string): JournalIssue[] {
  return JOURNAL_ISSUES.filter(i => i.journalId === journalId);
}

export function getIssuesByYear(journalId: string): Record<number, JournalIssue[]> {
  const issues = getIssuesByJournalId(journalId);
  return issues.reduce((acc, issue) => {
    if (!acc[issue.year]) acc[issue.year] = [];
    acc[issue.year].push(issue);
    return acc;
  }, {} as Record<number, JournalIssue[]>);
}

export function getBookVideosByBookId(bookId: string): Video[] {
  return VIDEOS.filter(v => v.relatedBookId === bookId && v.category === "book_video");
}

export function getVideoSetVideos(videoSetId: string): Video[] {
  return VIDEO_SET_VIDEOS.filter(v => v.videoSetId === videoSetId);
}

export function searchAll(query: string): {
  journals: Journal[];
  articles: Article[];
  books: Book[];
  chapters: Chapter[];
  videos: Video[];
  videoSets: VideoSet[];
} {
  const q = query.toLowerCase().trim();
  if (!q) return { journals: [], articles: [], books: [], chapters: [], videos: [], videoSets: [] };
  return {
    journals: JOURNALS.filter(j => j.title.toLowerCase().includes(q) || j.shortTitle.toLowerCase().includes(q)),
    articles: ARTICLES.filter(a => a.title.toLowerCase().includes(q) || a.authors.some(au => au.toLowerCase().includes(q)) || a.keywords.some(k => k.toLowerCase().includes(q))),
    books: BOOKS.filter(b => b.title.toLowerCase().includes(q) || b.authors.some(au => au.toLowerCase().includes(q)) || b.category.toLowerCase().includes(q)),
    chapters: CHAPTERS.filter(c => c.title.toLowerCase().includes(q) || c.authors.some(au => au.toLowerCase().includes(q))),
    videos: ALL_VIDEOS.filter(v => v.title.toLowerCase().includes(q) || v.tags.some(t => t.toLowerCase().includes(q)) || v.authors.some(au => au.toLowerCase().includes(q))),
    videoSets: VIDEO_SETS.filter(vs => vs.title.toLowerCase().includes(q) || vs.organizer.toLowerCase().includes(q) || vs.tags.some(t => t.toLowerCase().includes(q))),
  };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}
