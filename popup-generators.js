function randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n, w) { return String(n).padStart(w, "0"); }

function genFirst() {
  const s = ["J","A","M","S","D","C","R","T","E","K","N","L","B","H","P","V","W","G","Z","O"];
  const m = ["a","o","e","i","u","an","en","in","on","ar","or","el","al","am","em","ad","ed","av","ev","as","es","is","at","et","it","ac","ic","ol","il","ak","ek","ik","ap","ep","ip"];
  const e = ["n","s","d","t","h","nn","ss","tt","ck","rk","th","nd","ld","rd","st","nt","rt","ll","mm","rl","rn","ry","ro"];
  return randFrom(s) + randFrom(m) + (Math.random() > 0.45 ? randFrom(m) : "") + randFrom(e);
}
function genLast() {
  const s = ["S","M","W","B","J","H","C","R","A","D","T","G","K","L","P","F","E","N","V","O"];
  const m = ["i","o","a","e","u","ar","er","or","al","el","il","am","em","im","an","en","in","on","un","ow","aw","ay","ey","le","so","to","man","for","land","wood","field","well","hill","ham","b","l","f","m","p","r","s","t","k","d","g","w","n","y"];
  const e = ["s","n","r","d","t","l","k","e","y","son","ton","man","er","ley","ett","sen","ham","berg","burg","stein","shire","field","ford","wood","well","hill","land","ward","lyn","ers","ick","art","ark","ink","ers","son","ton","man","ley","ett","sen","ham","by"];
  return randFrom(s) + randFrom(m) + (Math.random() > 0.3 ? randFrom(e) : "");
}
function genEmail() { return genFirst().toLowerCase() + "." + genLast().toLowerCase() + randInt(10, 999) + randFrom(["@gmail.com","@yahoo.com","@outlook.com","@icloud.com","@proton.me","@example.com"]); }
function genPhone() { return "555-" + pad(randInt(100, 999), 3) + "-" + pad(randInt(1000, 9999), 4); }
function genCountry() { return randFrom(["United States","Canada","United Kingdom","Australia","Germany","France","Japan","Brazil","India","Mexico","Italy","Spain","Netherlands","Sweden","South Korea","Singapore","New Zealand","Switzerland","Norway","Denmark"]); }
function genCity() { return randFrom(["New York","Los Angeles","Chicago","Houston","London","Manchester","Toronto","Vancouver","Sydney","Melbourne","Berlin","Munich","Paris","Tokyo","Osaka","Mumbai","Delhi","Sao Paulo","Madrid","Barcelona","Amsterdam","Stockholm","Seoul","Singapore","Zurich","Copenhagen","Rome","Dublin","Dubai","Bangalore","Austin","Denver","Portland","Seattle","Boston","Nashville","Miami","Atlanta","Phoenix","Montreal"]); }
function genState() { return randFrom(["California","Texas","Florida","New York","Illinois","Pennsylvania","Ohio","Georgia","North Carolina","Michigan","New Jersey","Virginia","Washington","Arizona","Massachusetts","Tennessee","Indiana","Missouri","Maryland","Wisconsin","Colorado","Minnesota","Alabama","South Carolina","Louisiana","Kentucky","Oregon","Oklahoma","Connecticut","Nevada","Utah","Iowa","Kansas","Arkansas","Mississippi","Hawaii","Alaska"]); }
function genStreet() { return randInt(100, 9999) + " " + randFrom(["Main St","Oak Ave","Elm St","Park Rd","Broadway","High St","Maple Dr","Cedar Ln","Lake View","Sunset Blvd","River Rd","Hill St","Pine Ave","Forest Dr","Meadow Ln","Willow Way","Creek Ct","Springs Blvd","Harbor Dr","Valley Rd"]); }
function genZip() { return pad(randInt(10000, 99999), 5); }
function genPassword() { return genFirst().toLowerCase() + genLast().toLowerCase() + randInt(10, 999) + randFrom(["!","@","#","$"]); }
function genCompany() { return randFrom(["Acme","Globex","Initech","Umbrella","Stark","Wayne","Cyberdyne","Hooli","Dunder","Oscorp","Soylent","Wonka","Aperture","Tyrell","Massive","Nimbus","Gekko","Sterling","Vandelay","Prestige"]) + " " + randFrom(["Corp","Inc","LLC","Industries","Technologies","Group","Labs","Systems","Media","Ventures","Global","Solutions","Dynamics","Works","Enterprises"]); }
function genJob() { return randFrom(["Senior","Lead","Principal","Staff","Junior","",""]) + (Math.random() > 0.3 ? " " : "") + randFrom(["Software Engineer","Product Manager","Data Analyst","UX Designer","DevOps Engineer","QA Tester","Technical Writer","Solutions Architect","Security Analyst","ML Engineer","Full Stack Developer","Frontend Developer","Backend Developer","Engineering Manager","Product Designer","Scrum Master","Business Analyst","Marketing Manager","Sales Associate","Accountant","HR Coordinator","Consultant","Operations Manager","Creative Director","Research Scientist","Systems Admin","Network Engineer","Support Specialist","Data Scientist","Cloud Architect"]); }
function genUrl() { return "https://" + genFirst().toLowerCase() + randFrom(["com","net","io","org","co","app"]); }
function genDate() { return "199" + randInt(0, 9) + "-" + pad(randInt(1, 12), 2) + "-" + pad(randInt(1, 28), 2); }
function genLorem() { return "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."; }
function genRichText() { return "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p><p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>"; }
function genWord() { return randFrom(["alpha","beta","gamma","delta","omega","sigma","prime","edge","peak","core","base","nova","pulse","drive","wave","flux","grid","node","byte","hive","synth","neo","zen","ark","forge","tide","bold","cast","peak","dawn","echo"]); }

const acMap = {
  "given-name":"first","first-name":"first","cc-given-name":"first",
  "family-name":"last","last-name":"last","cc-family-name":"last",
  "name":"name","cc-name":"name",
  "nickname":"username","username":"username",
  "email":"email",
  "tel":"phone","tel-national":"phone","tel-area-code":"phone","home-phone":"phone","mobile":"phone","work-phone":"phone",
  "country":"country","country-name":"country",
  "address-level1":"state","address-level2":"city",
  "postal-code":"zip","zip":"zip",
  "street-address":"street","address-line1":"street","address-line2":"apt","address-line3":"street",
  "organization":"company","company":"company",
  "organization-title":"job","job-title":"job",
  "bday":"date","bday-day":"date","bday-month":"month","bday-year":"year",
  "sex":"gender","gender":"gender",
  "url":"url",
  "cc-number":"ccnum","cc-exp":"ccexp","cc-exp-month":"month","cc-exp-year":"year",
  "cc-csc":"cvv","cc-security-code":"cvv","cc-type":"cctype",
  "transaction-currency":"currency","transaction-amount":"amount",
  "one-time-code":"otp",
  "new-password":"password","current-password":"password",
  "language":"lang","photo":"url"
};
const typeStrictMap = { "email":"email", "tel":"phone", "phone":"phone", "url":"url", "password":"password" };
const typeLooseMap = { "number":"number", "range":"number", "date":"date", "time":"time", "datetime-local":"datetime", "month":"month", "week":"week", "color":"color", "checkbox":"checkbox", "radio":"radio" };

const labelRules = [
  [/cnic|nic|national.?id|identity.?number|id.?number/, "cnic"],
  [/ssn|social.?security/, "ssn"],
  [/passport/, "passport"],
  [/pan.?number|pan.?card|pan.?no/, "pan"],
  [/aadhaar|aadhar|uid/, "aadhaar"],
  [/tax.?id|taxid|tin|e.?in/, "taxid"],
  [/driver.?lic|dl.?number|lic.?number|driving.?lic/, "drivers"],
  [/vin|vehicle.?id|chassis.?no/, "vin"],
  [/credit.?card|debit.?card|cc.?number|card.?number/, "ccnum"],
  [/cvv|cvc|csc|security.?code|secure.?code/, "cvv"],
  [/expir|exp\.?|valid.?thru|valid.?till|mm.?yy/, "ccexp"],
  [/account.?no|account.?number|acc.?no|iban/, "acct"],
  [/routing|aba.?number|sort.?code/, "routing"],
  [/swift|bic|bank.?code/, "swift"],
  [/pincode|postal|postcode|zip/, "zip"],
  [/country|nation/, "country"],
  [/city|town/, "city"],
  [/state|province|region/, "state"],
  [/address|street|addr/, "street"],
  [/apt|unit|suite|flat/, "apt"],
  [/room|floor|level|building.?no/, "room"],
  [/birth|dob|born|date.?of.?birth/, "date"],
  [/gender|sex/, "gender"],
  [/age/, "age"],
  [/full.?name|your.?name|enter.?name/, "name"],
  [/first.?name|fname|given/, "first"],
  [/last.?name|lname|family|surname/, "last"],
  [/prefix|honorific|title.?mr|mr.?ms|salutation/, "prefix"],
  [/suffix|jr|sr|ii|iii|iv/, "suffix"],
  [/username|user.?name|login|nick/, "username"],
  [/nationality|citizen/, "nationality"],
  [/status(?!.*(?:family|marital))/, "genstatus"],
  [/marital|married|single/, "marital"],
  [/education|degree|school|university|college|major|qualification/, "edulevel"],
  [/company|organization|org|employer|firm|works? at|department/, "company"],
  [/job.?title|position|designation|occupation|role/, "job"],
  [/website|web.?site|homepage|blog.?url/, "url"],
  [/fax/, "phone"],
  [/mobile|cell|cellular|phone|telephone|tel|contact.?no|contact.?number|whatsapp/, "phone"],
  [/sku|product.?id|item.?no|part.?no|model.?no/, "sku"],
  [/order.?no|order.?id|ref.?no|invoice|ticket.?no/, "order"],
  [/coupon|promo|discount.?code|voucher/, "coupon"],
  [/qty|quantity|count|total.?items/, "qty"],
  [/weight|mass|kg|lbs|pounds/, "weight"],
  [/height|ft|inches|cm/, "height"],
  [/temp|temperature|celsius|fahrenheit/, "temp"],
  [/color|colour|hue|shade/, "colorword"],
  [/plate.?no|license.?plate|reg.?no/, "plate"],
  [/subject|title/, "text"],
  [/message|comment|enquiry|inquiry|feedback|description|details|note/, "lorem"],
  [/search/, "empty"],
  [/name/, "name"],
  [/email|e-?mail/, "email"],
  [/phone|telephone|mobile|cell|contact/, "phone"],
];

const acDetect = (f) => acMap[(f.autocomplete || "").toLowerCase()] || null;
const typeStrict = (f) => typeStrictMap[f.type || ""] || null;
const typeLoose = (f) => { if (f.tag === "textarea") return "lorem"; return typeLooseMap[f.type || ""] || null; };
const labelDetect = (f) => {
  const l = ((f.label||"") + " " + (f.name||"") + " " + (f.id||"") + " " + (f.placeholder||"") + " " + (f.autocomplete||"")).toLowerCase();
  for (const [re, key] of labelRules) { if (re.test(l)) return key; }
  return null;
};

const detectors = [acDetect, typeStrict, typeLoose, labelDetect];

const generators = {
  "first":   () => genFirst(),
  "last":    () => genLast(),
  "name":    () => genFirst() + " " + genLast(),
  "username":() => genFirst().toLowerCase() + genLast().toLowerCase() + randInt(10, 999),
  "email":   () => genEmail(),
  "phone":   () => genPhone(),
  "country": () => genCountry(),
  "state":   () => genState(),
  "city":    () => genCity(),
  "zip":     () => genZip(),
  "street":  () => genStreet(),
  "apt":     () => "Apt " + randInt(1, 20),
  "date":    () => genDate(),
  "month":   () => "2026-" + pad(randInt(1, 12), 2),
  "year":    () => String(randInt(1970, 2010)),
  "time":    () => pad(randInt(8, 19), 2) + ":" + pad(randInt(0, 3) * 15, 2),
  "datetime":() => "2026-" + pad(randInt(1, 12), 2) + "-" + pad(randInt(1, 28), 2) + "T" + pad(randInt(8, 19), 2) + ":00",
  "week":    () => "2026-W" + pad(randInt(1, 52), 2),
  "color":   () => "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"),
  "number":  (f) => String(randInt(Number(f && f.min) || 1, Number(f && f.max) || 9999)),
  "gender":  () => randFrom(["Male", "Female", "Other"]),
  "company": () => genCompany(),
  "job":     () => genJob(),
  "age":     () => String(randInt(18, 75)),
  "url":     () => genUrl(),
  "password":() => genPassword(),
  "lorem":   () => genLorem(),
  "text":    () => genWord() + " " + genWord() + " " + genWord(),
  "cnic":    () => pad(randInt(10000, 99999), 5) + "-" + pad(randInt(1000000, 9999999), 7) + "-" + randInt(0, 9),
  "ssn":     () => pad(randInt(100, 999), 3) + "-" + pad(randInt(10, 99), 2) + "-" + pad(randInt(1000, 9999), 4),
  "passport":() => String.fromCharCode(randInt(65, 90)) + String.fromCharCode(randInt(65, 90)) + pad(randInt(1000000, 9999999), 7),
  "pan":     () => "A" + String.fromCharCode(randInt(66, 90)) + String.fromCharCode(randInt(66, 90)) + String.fromCharCode(randInt(66, 90)) + "P" + String.fromCharCode(randInt(65, 90)) + pad(randInt(1000, 9999), 4),
  "aadhaar": () => pad(randInt(1000, 9999), 4) + " " + pad(randInt(1000, 9999), 4) + " " + pad(randInt(1000, 9999), 4),
  "ccnum":   () => "4111-1111-1111-" + pad(randInt(1000, 9999), 4),
  "cvv":     () => pad(randInt(100, 999), 3),
  "ccexp":   () => pad(randInt(1, 12), 2) + "/" + (new Date().getFullYear() + randInt(1, 5)),
  "cctype":  () => randFrom(["Visa", "MasterCard", "AmEx", "Discover"]),
  "currency":() => "USD",
  "amount":  () => (Math.random() * 500 + 10).toFixed(2),
  "otp":     () => pad(randInt(100000, 999999), 6),
  "lang":    () => "English",
  "options": (f) => randFrom(f.options),
  "checkbox":() => "on",
  "radio":   (f) => f.options && f.options.length ? randFrom(f.options) : "Yes",
  "empty":   () => "",
  "taxid":   () => pad(randInt(10, 99), 2) + "-" + pad(randInt(1000000, 9999999), 7),
  "drivers": () => "D" + pad(randInt(100, 999), 3) + "-" + pad(randInt(1000, 9999), 4) + "-" + pad(randInt(1000, 9999), 4),
  "vin":     () => { const c="ABCDEFGHJKLMNPRSTUVWXYZ0123456789"; return Array.from({length:17},()=>c[randInt(0,c.length-1)]).join(""); },
  "acct":    () => pad(randInt(10000000, 99999999), 8),
  "routing": () => pad(randInt(10000000, 99999999), 8),
  "swift":   () => String.fromCharCode(randInt(65,90),randInt(65,90),randInt(65,90),randInt(65,90)) + "US" + String.fromCharCode(randInt(65,90),randInt(65,90)) + "XXX",
  "room":    () => "Room " + randInt(100, 9999),
  "qty":     () => String(randInt(1, 100)),
  "weight":  () => randInt(50, 350) + " lbs",
  "height":  () => randInt(4, 6) + "'" + randInt(0, 11) + '"',
  "temp":    () => randInt(60, 100) + "\u00B0F",
  "colorword":() => randFrom(["Red","Blue","Green","Black","White","Silver","Gold","Navy","Teal","Purple","Orange","Pink","Brown","Gray","Coral","Indigo","Violet","Cyan","Lime","Maroon"]),
  "sku":     () => "SKU-" + pad(randInt(10000, 99999), 5),
  "order":   () => "ORD-" + pad(randInt(100000, 999999), 6),
  "coupon":  () => genWord().toUpperCase() + randInt(10, 99),
  "edulevel":() => randFrom(["High School","Associate's","Bachelor's","Master's","PhD","Certificate","Diploma","MBA","MD","JD"]),
  "marital": () => randFrom(["Single","Married","Divorced","Widowed","Separated"]),
  "prefix":  () => randFrom(["Mr.","Ms.","Mrs.","Dr.","Prof.","Capt.","Col.","Hon."]),
  "suffix":  () => randFrom(["Jr.","Sr.","II","III","IV","PhD","MD","Esq.","CPA"]),
  "nationality":() => randFrom(["American","Canadian","British","Australian","German","French","Japanese","Brazilian","Indian","Mexican","Italian","Spanish","Dutch","Swedish","South Korean","Chinese","Russian","Swiss"]),
  "genstatus":() => randFrom(["Active","Inactive","Suspended","Pending","Approved","Rejected"]),
};

function applyConstraints(val, field) {
  if (typeof val === 'string') {
    if (field.maxLength > 0 && val.length > field.maxLength) val = val.substring(0, field.maxLength);
    if (field.minLength > 0 && val.length < field.minLength) val = val.padEnd(field.minLength, 'x').substring(0, field.maxLength > 0 ? field.maxLength : val.length + field.minLength);
  }
  if (field.type === 'number' || field.type === 'range') {
    var num = Number(val);
    if (field.min !== '' && num < Number(field.min)) val = String(field.min);
    if (field.max !== '' && num > Number(field.max)) val = String(field.max);
    if (field.step !== '') { var st = Number(field.step); if (st > 0) val = String(Math.round(num / st) * st); }
  }
  return val;
}

function generateRandomValue(field) {
  if (field.type === "file") return "";
  if (field.type === "richtext") return genRichText();
  if (field.type === "textarea") return genLorem();
  if (field.options && field.options.length > 0) return applyConstraints(randFrom(field.options), field);
  for (const detect of detectors) {
    const key = detect(field);
    if (key && generators[key]) return applyConstraints(generators[key](field), field);
  }
  return applyConstraints(generators["text"](field), field);
}
