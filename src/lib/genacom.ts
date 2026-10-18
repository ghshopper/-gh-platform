/** Genacom offices for pickup. The server sends the current list
 *  (/ps/delivery-options); this copy is used until it arrives. */
export interface GenacomBranch {
  id: string;
  gov: string;
  name: string;
  where: string;
  wa?: string | null;
  map?: string | null;
  /** In Muscat / Barka, where our own driver also delivers. */
  local: boolean;
}

export const GENACOM_BRANCHES: GenacomBranch[] = [
    {
        "id": "seeb",
        "gov": "مسقط",
        "name": "السيب — الفرع الرئيسي",
        "where": "السيب",
        "wa": "96871959002",
        "map": null,
        "local": true
    },
    {
        "id": "mabelah",
        "gov": "مسقط",
        "name": "المعبيلة",
        "where": "بجانب العريمي بوليفارد",
        "wa": null,
        "map": "https://shorturl.at/jEJOT",
        "local": true
    },
    {
        "id": "ghubrah",
        "gov": "مسقط",
        "name": "الغبرة",
        "where": "مقابل مجمع بوشر الرياضي، خلف مدرسة الإبداع العالمية",
        "wa": "96896900850",
        "map": "https://maps.app.goo.gl/itACzL5sx5jcxfAH6",
        "local": true
    },
    {
        "id": "amerat",
        "gov": "مسقط",
        "name": "العامرات",
        "where": "مقابل جسر العامرات",
        "wa": "96890623260",
        "map": null,
        "local": true
    },
    {
        "id": "khoudh",
        "gov": "مسقط",
        "name": "الخوض السادسة",
        "where": "بعد دوار الكتاب، مقابل جامعة السلطان قابوس",
        "wa": "96892111875",
        "map": "https://shorturl.at/CGLPQ",
        "local": true
    },
    {
        "id": "ruwi",
        "gov": "مسقط",
        "name": "روي",
        "where": "بعد دوار الحمرية",
        "wa": "96898928652",
        "map": "https://shorturl.at/wjzOG",
        "local": true
    },
    {
        "id": "quriyat",
        "gov": "مسقط",
        "name": "قريات",
        "where": "السوق",
        "wa": "96895639996",
        "map": "https://shorturl.at/ajDZ6",
        "local": true
    },
    {
        "id": "barka",
        "gov": "جنوب الباطنة",
        "name": "بركاء",
        "where": "خلف وكالة MG",
        "wa": "96871585800",
        "map": null,
        "local": true
    },
    {
        "id": "rustaq",
        "gov": "جنوب الباطنة",
        "name": "الرستاق",
        "where": "بجانب الإشارات وحلوى الحزم وأمير العود",
        "wa": "96879900210",
        "map": "https://maps.app.goo.gl/sqCoZJFFVkybfsGS8",
        "local": false
    },
    {
        "id": "musannah",
        "gov": "جنوب الباطنة",
        "name": "المصنعة",
        "where": "منطقة الشعيبة، بجانب محلات رزة وآرتي كافيه",
        "wa": "96891912104",
        "map": "https://maps.app.goo.gl/bKJ2a7xxqgua6kvMA",
        "local": false
    },
    {
        "id": "nakhal",
        "gov": "جنوب الباطنة",
        "name": "نخل / العوابي / وادي المعاول",
        "where": "بجانب مطعم مائدة العطاء وروح كافيه",
        "wa": "96895869998",
        "map": "https://maps.app.goo.gl/ExJTq7XKgT77hKhv5",
        "local": false
    },
    {
        "id": "sohar",
        "gov": "شمال الباطنة",
        "name": "صحار",
        "where": "صحار",
        "wa": "96892096664",
        "map": null,
        "local": false
    },
    {
        "id": "khaburah",
        "gov": "شمال الباطنة",
        "name": "الخابورة",
        "where": "البريك، بجانب أشواق كافيه",
        "wa": "96893339437",
        "map": "https://maps.app.goo.gl/miNmvRhzKaW6AXKFA",
        "local": false
    },
    {
        "id": "suwaiq",
        "gov": "شمال الباطنة",
        "name": "السويق",
        "where": "الصبيخي، مقابل الشارع العام",
        "wa": "96896113151",
        "map": null,
        "local": false
    },
    {
        "id": "shinas",
        "gov": "شمال الباطنة",
        "name": "شناص",
        "where": "السوق، بجانب الجزيرة الدولية للتسوق",
        "wa": "96891113761",
        "map": null,
        "local": false
    },
    {
        "id": "liwa",
        "gov": "شمال الباطنة",
        "name": "لوى",
        "where": "شارع السلطان قابوس",
        "wa": "96893800017",
        "map": null,
        "local": false
    },
    {
        "id": "saham",
        "gov": "شمال الباطنة",
        "name": "صحم",
        "where": "بعد الدوار باتجاه مسقط، بجانب مكتب الوالي",
        "wa": "96890909918",
        "map": "https://shorturl.at/axGI1",
        "local": false
    },
    {
        "id": "nizwa",
        "gov": "الداخلية",
        "name": "نزوى",
        "where": "فرق، خلف بنك العز",
        "wa": "96890674441",
        "map": "https://goo.gl/maps/jNprXz27CYcFnv569",
        "local": false
    },
    {
        "id": "izki",
        "gov": "الداخلية",
        "name": "إزكي",
        "where": "بجانب بيت الواسط وورود جرنان",
        "wa": "96893236682",
        "map": "https://maps.app.goo.gl/F6N5UwQdDgGocM9e6",
        "local": false
    },
    {
        "id": "samail",
        "gov": "الداخلية",
        "name": "سمائل",
        "where": "خلف البنك الوطني العماني، بجانب مقهى ريف التركي",
        "wa": "96891966643",
        "map": "https://maps.app.goo.gl/TDjN2zqxxWFtVN496",
        "local": false
    },
    {
        "id": "bahla",
        "gov": "الداخلية",
        "name": "بهلاء",
        "where": "مويهي المر، بجانب دائرة كاتب العدل",
        "wa": "96890674441",
        "map": "https://rb.gy/nlztm7",
        "local": false
    },
    {
        "id": "fanja",
        "gov": "الداخلية",
        "name": "فنجاء",
        "where": "سيح الأحمر، بعد محطة نفط عمان باتجاه الداخلية",
        "wa": "96892112502",
        "map": null,
        "local": false
    },
    {
        "id": "sinaw",
        "gov": "شمال الشرقية",
        "name": "سناو",
        "where": "سناو",
        "wa": "96892054666",
        "map": "https://shorturl.at/jpB06",
        "local": false
    },
    {
        "id": "ibra",
        "gov": "شمال الشرقية",
        "name": "إبراء",
        "where": "السفالة، مقابل بوتيك ورد",
        "wa": "96895777384",
        "map": "https://maps.app.goo.gl/VkMG62njsodL6QKq8",
        "local": false
    },
    {
        "id": "sur",
        "gov": "جنوب الشرقية",
        "name": "صور",
        "where": "صور الشرية، بجانب عيادة مصيرة لطب الأسنان",
        "wa": "96898117162",
        "map": "https://goo.gl/maps/36KRXFgKoB4ws4ky5",
        "local": false
    },
    {
        "id": "kamil",
        "gov": "جنوب الشرقية",
        "name": "الكامل والوافي",
        "where": "بجانب جامع الشريعة الكبير، مقابل سوق الخميس",
        "wa": "96899882642",
        "map": "https://maps.app.goo.gl/oZ23ScfTZ29DYP579",
        "local": false
    },
    {
        "id": "jaalan",
        "gov": "جنوب الشرقية",
        "name": "جعلان",
        "where": "اللوية، بجانب مجمع جعلان الصحي",
        "wa": "96898117162",
        "map": "https://shorturl.at/fJLRZ",
        "local": false
    },
    {
        "id": "ibri",
        "gov": "الظاهرة",
        "name": "عبري",
        "where": "مقابل جامع السلطان قابوس، بجانب صالة أوريدو ومحطة شل",
        "wa": "96898250009",
        "map": "https://maps.app.goo.gl/72cABkqLDJsziBhf9",
        "local": false
    },
    {
        "id": "yanqul",
        "gov": "الظاهرة",
        "name": "ينقل",
        "where": "الصوادر، مقابل جامع عمر بن الخطاب",
        "wa": "96892416404",
        "map": "https://t.ly/9UHAi",
        "local": false
    },
    {
        "id": "buraimi",
        "gov": "البريمي",
        "name": "البريمي",
        "where": "صعراء الجديدة، سوق الجو بجانب مجمع البريمي الصحي",
        "wa": "96897555125",
        "map": "https://maps.app.goo.gl/eEN4Vky6S9xxeX6A8",
        "local": false
    },
    {
        "id": "salalah",
        "gov": "ظفار",
        "name": "صلالة",
        "where": "صلالة",
        "wa": "96899835319",
        "map": "https://shorturl.at/hAEHX",
        "local": false
    }
];
