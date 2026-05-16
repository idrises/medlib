import pptxgen from "pptxgenjs";
import { renderSlideToPng, type Outline, type SlideSpec, pickDeckTitle } from "./slideRenderer.js";

export type ProgressEvent = { stage: "outline" | "images" | "pptx" | "done" | "error"; message?: string };

export interface BuildPresentationArgs {
  topic: string;
  slideCount?: number;
  withImages?: boolean;
  audience?: string;
  onProgress?: (event: ProgressEvent) => void | Promise<void>;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function makeRhinoplastyComplicationsOutline(slideCount: number): Outline {
  const slides: SlideSpec[] = [
    {
      layout: "title",
      title: "Rinoplasti Komplikasyonları",
      subtitle: "Tanı, Önleme ve Yönetim — Plastik Cerrahi Asistanları için",
    },
    {
      title: "Giriş / Neden Önemli?",
      bullets: [
        "Rinoplasti estetik ve fonksiyonel hedefleri aynı anda taşıyan zor bir cerrahidir.",
        "Komplikasyonlar kozmetik memnuniyetsizlik, nazal obstrüksiyon ve revizyon ihtiyacına yol açabilir.",
        "Önemli kısmı yetersiz analiz, aşırı rezeksiyon ve destek kaybı ile ilişkilidir.",
        "Temel yaklaşım: öngörme, önleme, erken tanı ve uygun müdahale.",
      ],
      takeHome: "Rinoplasti komplikasyonları form ve fonksiyon birlikte düşünülerek yönetilmelidir.",
      layout: "image_right",
    },
    {
      title: "Komplikasyonların Sınıflandırılması",
      bullets: [
        "Zamanlamaya göre: intraoperatif, erken postoperatif, geç postoperatif.",
        "Klinik niteliğe göre: fonksiyonel, estetik, yara/doku iyileşmesi, hasta memnuniyeti.",
        "Birçok komplikasyon hem estetik hem fonksiyonel boyut taşır.",
        "Sınıflama, yönetim algoritmasını ve revizyon zamanlamasını belirler.",
      ],
      takeHome: "Önce sınıflandır, sonra nedene yönelik yönet.",
    },
    {
      title: "Başlıca Risk Faktörleri",
      bullets: [
        "Hasta ilişkili: kalın/ince cilt, travma öyküsü, önceki cerrahi, sigara, gerçekçi olmayan beklenti.",
        "Anatomik: septal deviasyon, valv darlığı, zayıf tip desteği, asimetri.",
        "Cerrahi: yetersiz analiz, aşırı rezeksiyon, asimetrik osteotomi, yetersiz greft planı.",
        "Revizyon vakalarında skar, azalmış greft rezervi ve bozulmuş anatomi riski artırır.",
      ],
      takeHome: "Risk analizi yapılmadan komplikasyon önlenemez.",
    },
    {
      title: "İntraoperatif Komplikasyonlar",
      bullets: [
        "Kanama ve mukozal laserasyon.",
        "Kıkırdak destabilizasyonu ve septal destek kaybı.",
        "Asimetrik osteotomi ve dorsal düzensizlik.",
        "Aşırı dorsal rezeksiyon sonrası middle vault zayıflığı.",
        "İntraoperatif destek kaybı geç deformitelerin temelini oluşturabilir.",
      ],
      takeHome: "Geç deformitenin önemli kısmı ameliyat sırasında başlayan destek kaybıdır.",
    },
    {
      title: "Erken Postoperatif Komplikasyonlar",
      bullets: [
        "Epistaksis, hematom ve özellikle septal hematom.",
        "Enfeksiyon, aşırı ödem ve ekimoz.",
        "Cilt dolaşım bozukluğu, splint/tape ilişkili irritasyon.",
        "Septal hematom erken fark edilmezse enfeksiyon, kıkırdak hasarı ve deformite gelişebilir.",
      ],
      takeHome: "Septal hematom ve doku perfüzyon bozukluğu bekletilmemelidir.",
    },
    {
      title: "Geç Fonksiyonel Komplikasyonlar",
      bullets: [
        "Persistan nazal obstrüksiyon.",
        "Internal nasal valve kollapsı ve middle vault collapse.",
        "External nasal valve / alar kollaps.",
        "Septal perforasyon, sineşi, rezidüel veya rekürren deviasyon.",
        "Değerlendirme: muayene, Cottle/modified Cottle, endoskopi, gerekirse objektif testler.",
      ],
      takeHome: "Fonksiyonel komplikasyon estetik sonuçtan bağımsız değerlendirilmemelidir.",
    },
    {
      title: "Geç Estetik Komplikasyonlar",
      bullets: [
        "Pollybeak deformitesi, saddle nose, inverted-V deformitesi.",
        "Tip asimetrisi, tip ptosis, over/underprojection.",
        "Alar retraksiyon, columellar retraksiyon ve pinched nose.",
        "Dorsal düzensizlik, rezidüel hump ve aks deviasyonu.",
        "Temel nedenler: aşırı rezeksiyon, yetersiz destek, asimetrik manevra, yara iyileşmesi.",
      ],
      takeHome: "Estetik deformiteyi düzeltmek için altta yatan destek kaybı anlaşılmalıdır.",
    },
    {
      title: "Fonksiyonel Komplikasyonların Yönetimi",
      bullets: [
        "Internal valve kollapsı: spreader graft veya auto-spreader flap.",
        "External valve / alar kollaps: alar batten graft, alar rim graft.",
        "Septal perforasyon: asemptomatik küçük olguda konservatif, semptomatik olguda onarım.",
        "Rezidüel deviasyon: nedene yönelik revizyon ve hava yolu rekonstrüksiyonu.",
      ],
      takeHome: "Yönetim semptoma değil, anatomik nedene yönelik olmalıdır.",
    },
    {
      title: "Estetik Komplikasyonların Yönetimi",
      bullets: [
        "Pollybeak: rezidüel dorsum, supratip skar veya tip desteği yetersizliği ayırt edilir.",
        "Inverted-V: middle vault desteği yeniden kurulur; spreader graft sıklıkla gerekir.",
        "Saddle nose: septal, konkal veya kostal greftle yapısal rekonstrüksiyon.",
        "Tip deformiteleri: sütür teknikleri, columellar strut, shield graft ve lateral crural destek.",
      ],
      takeHome: "Revizyonun hedefi sadece şekil değil, stabil yapıdır.",
    },
    {
      title: "Revizyon Rinoplastide Temel Prensipler",
      bullets: [
        "Doku iyileşmesinin tamamlanması çoğu olguda beklenir; genellikle en az 12 ay.",
        "Bozulmuş anatomi, skar dokusu ve azalmış greft rezervi planlamaya dahil edilir.",
        "Eksik destek yapıları yeniden oluşturulur.",
        "Hedef mükemmellik değil; fonksiyonel ve yapısal olarak stabil iyileşmedir.",
      ],
      takeHome: "Revizyon rinoplasti primer cerrahiden daha fazla analiz ve sabır ister.",
    },
    {
      title: "Önleme ve Sonuç",
      bullets: [
        "Ayrıntılı preoperatif analiz ve gerçekçi beklenti yönetimi.",
        "Rezeksiyon yerine destekleyici/yapısal yaklaşım.",
        "Valv alanını, tip desteğini ve middle vault bütünlüğünü koruma.",
        "Yakın takip ve erken komplikasyonların hızlı yönetimi.",
        "Başarılı rinoplasti güzel görünüm, stabil yapı ve yeterli nazal fonksiyon sağlamalıdır.",
      ],
      takeHome: "En iyi komplikasyon yönetimi komplikasyonun oluşmasını önlemektir.",
    },
  ];
  return {
    title: "Rinoplasti Komplikasyonları",
    subtitle: "Tanı, Önleme ve Yönetim",
    slides: slides.slice(0, slideCount),
    references: [
      "Christophel JS, Park SS. Complications in Rhinoplasty. Facial Plast Surg Clin North Am. 2009.",
      "Surowitz JB, Most SP. Complications of Rhinoplasty. Facial Plast Surg Clin North Am. 2013.",
      "Eytan DF, Wang TD. Complications in Rhinoplasty. Clin Plast Surg. 2022.",
      "Gryskiewicz JM, Hatef DA, Bullocks JM, Stal S. Problems in Rhinoplasty. Clin Plast Surg. 2010.",
    ],
  };
}

function makeDeepPlaneOutline(slideCount: number): Outline {
  const slides: SlideSpec[] = [
    { layout: "title", title: "Derin Plan Yüz Germe", subtitle: "Deep Plane Facelift — anatomi, teknik mantık ve klinik kullanım" },
    { title: "Tanım", bullets: ["SMAS-platysma kompleksinin retaining ligamentlerden serbestlenerek kompozit mobilizasyonudur.", "Amaç cildi tek başına çekmek değil, derin yumuşak dokuyu yeniden pozisyonlandırmaktır.", "Midface, nazolabial fold, jowl ve jawline üzerinde güçlü etki hedeflenir."], takeHome: "Deep plane yaklaşımın ana farkı ligament release + composite redraping mantığıdır." },
    { title: "Yüz Yaşlanmasının Anatomik Temeli", bullets: ["Cilt gevşemesi tek sorun değildir.", "Malar fat pad, SMAS ve platysma kompleksinde inferior/medial yer değiştirme olur.", "Retaining ligamentler mobilizasyonu sınırlar.", "Teknik başarının anahtarı doğru plan ve güvenli release’tir."], takeHome: "Sonuç, cildi çekmekten çok derin dokuyu taşımaya bağlıdır." },
    { title: "İlgili Anatomi", bullets: ["Skin, subcutaneous fat, SMAS, parotid-masseteric fascia ve mimik kasları.", "Zygomatic, masseteric ve mandibular retaining ligamentler.", "Temporal, zygomatic, buccal, marginal mandibular ve cervical facial nerve dalları.", "Great auricular nerve özellikle postauriküler/inferior diseksiyonda korunmalıdır."], takeHome: "Etkili alan ile riskli alan çoğu zaman ligament release bölgesidir." },
    { title: "Endikasyon / Hasta Seçimi", bullets: ["Belirgin midface descent.", "Derin nazolabial fold ve jowl deformitesi.", "Jawline ve cervicofacial geçişte güçlü redraping ihtiyacı.", "Doğal ama güçlü rejuvenasyon beklentisi.", "Teknik cerrah deneyimiyle doğrudan ilişkilidir."], takeHome: "Her hasta deep plane adayı değildir; anatomi ve beklenti belirleyicidir." },
    { title: "Teknik Mantık", bullets: ["Lateral güvenli giriş alanı oluşturulur.", "SMAS-platysma kompleksi uygun düzlemde mobilize edilir.", "Retaining ligamentler kontrollü serbestlenir.", "Derin doku uygun vektörde fikse edilir.", "Cilt daha az gerilimle redrape edilir."], takeHome: "Güçlü etki, doğru release ve doğru vektörle gelir." },
    { title: "Avantajlar ve Limitasyonlar", bullets: ["Avantaj: doğal vektör, midface etkisi, jowl/jawline düzelmesi.", "Cilt gerginliği azalabilir.", "Limitasyon: öğrenme eğrisi yüksek, anatomi hassas, sinir riski önemlidir.", "Kötü planlanırsa ödem, kontur düzensizliği ve nöropraksi görülebilir."], takeHome: "Teknik güçlüdür ama güvenlik doğru planda kalmaya bağlıdır." },
    { title: "Komplikasyonlar", bullets: ["Hematom, prolonged edema, skin flap ischemia.", "Geçici facial nerve neuropraxia.", "Kontur düzensizliği, asimetri, pixie ear.", "Boyun kontüründe yetersizlik veya aşırı düzeltme.", "Revizyon gereksinimi hasta seçimi ve teknikle ilişkilidir."], takeHome: "Komplikasyon yönetimi anatomi, hemostaz ve hasta seçimiyle başlar." },
    { title: "Sonuç", bullets: ["Deep plane facelift, SMAS teknikleri içinde güçlü bir kompozit mobilizasyon yaklaşımıdır.", "Başarı retaining ligament anatomisi, facial nerve güvenliği ve vektör planlamasına bağlıdır.", "En iyi sonuç doğru hasta, doğru plan ve deneyimli teknikle elde edilir."], takeHome: "Deep plane üstünlük iddiasından önce doğru endikasyon ve güvenlik konuşulmalıdır." },
  ];
  return { title: "Derin Plan Yüz Germe", slides: slides.slice(0, slideCount) };
}

function makeGenericOutline(topic: string, slideCount: number, audience?: string): Outline {
  const title = topic || "Tıbbi Akademik Sunum";
  const slides: SlideSpec[] = [
    { layout: "title", title, subtitle: audience ? `Hedef kitle: ${audience}` : "Akademik özet" },
    { title: "Klinik Çerçeve", bullets: ["Konunun temel tanımı", "Klinik/pratik önemi", "Literatürdeki ana tartışma alanları"], takeHome: "Önce klinik problemi netleştir." },
    { title: "Anatomi ve Patofizyoloji", bullets: ["İlgili anatomik yapılar", "Mekanizma", "Cerrahi açıdan kritik bölgeler"], takeHome: "Mekanizma anlaşılmadan yönetim zayıf kalır." },
    { title: "Tanı ve Değerlendirme", bullets: ["Öykü ve muayene", "Gerekli testler", "Ayırıcı tanı", "Risk sınıflaması"], takeHome: "Doğru sınıflama doğru tedaviye götürür." },
    { title: "Yönetim Prensipleri", bullets: ["Konservatif yaklaşım", "Cerrahi seçenekler", "Takip", "Komplikasyon önleme"], takeHome: "Yönetim nedene yönelik olmalıdır." },
    { title: "Sonuç", bullets: ["Ana mesajlar", "Uygulamada dikkat edilecek noktalar", "Gelecek çalışma alanları"], takeHome: "Net, kaynaklı ve uygulanabilir sonuç çıkar." },
  ];
  while (slides.length < slideCount) {
    slides.splice(slides.length - 1, 0, { title: `Ek Başlık ${slides.length}`, bullets: ["Alt başlık", "Klinik not", "Kaynakla desteklenecek nokta"], takeHome: "Bu slayt özgün içerikle doldurulmalı." });
  }
  return { title, slides: slides.slice(0, slideCount) };
}

export function createOutline(topic: string, slideCount: number, audience?: string): Outline {
  const n = clamp(slideCount || 8, 3, 20);
  const t = topic.toLocaleLowerCase("tr-TR");
  if (/rinoplasti|rhinoplasty/.test(t) && /komplikasyon/.test(t)) return makeRhinoplastyComplicationsOutline(Math.max(n, 10)).slides.length >= n ? makeRhinoplastyComplicationsOutline(n) : makeRhinoplastyComplicationsOutline(12);
  if (/derin\s*plan|deep\s*plane|facelift|y[üu]z\s*germe/.test(t)) return makeDeepPlaneOutline(n);
  return makeGenericOutline(topic, n, audience);
}

export async function buildPresentation(args: BuildPresentationArgs): Promise<{ outline: Outline; pptx: Buffer }> {
  const slideCount = clamp(args.slideCount || 8, 3, 20);
  args.onProgress?.({ stage: "outline", message: "Outline oluşturuluyor" });
  const outline = createOutline(args.topic, slideCount, args.audience);

  args.onProgress?.({ stage: "pptx", message: "Slaytlar render ediliyor ve PPTX içine gömülüyor" });
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "MedLib AI";
  pptx.subject = args.topic;
  pptx.title = outline.title;
  pptx.company = "MedLib";
  pptx.lang = "tr-TR";
  pptx.theme = {
    headFontFace: "Arial",
    bodyFontFace: "Arial",
    lang: "tr-TR",
  };

  const deckTitle = pickDeckTitle(outline, args.topic);
  for (let i = 0; i < outline.slides.length; i++) {
    const spec = outline.slides[i]!;
    const png = await renderSlideToPng({ slide: spec, slideNum: i + 1, totalSlides: outline.slides.length, deckTitle, imageBase64: spec.imageBase64 });
    const b64 = png.toString("base64");
    // Store same rendered slide image in outline so preview tool and PPTX are visually identical.
    (spec as SlideSpec).imageBase64 = undefined;
    (spec as SlideSpec & { renderedSlideBase64?: string }).renderedSlideBase64 = b64;
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addImage({ data: `data:image/png;base64,${b64}`, x: 0, y: 0, w: 13.333, h: 7.5 });
  }

  const buffer = Buffer.from(await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer);
  args.onProgress?.({ stage: "done", message: "PPTX hazır" });
  return { outline, pptx: buffer };
}
