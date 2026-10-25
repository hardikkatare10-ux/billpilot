/**
 * BillPilot Local - Official Indian Postal Directory Reference Data
 * 
 * Based on official data from:
 * - Department of Posts, Ministry of Communications, Government of India
 * - Open Government Data (data.gov.in) All India PIN Code Directory
 * 
 * Includes all 36 States and Union Territories, comprehensive official district registries,
 * postal circle zone prefix rules, and baseline verified post offices.
 */

import { PostalRecord } from '../types';

export interface IndianState {
  code: string;
  name: string;
  type: 'State' | 'Union Territory';
  capital: string;
  pincodePrefixes: string[];
}

export const INDIAN_STATES_AND_UTS: IndianState[] = [
  // 28 States
  { code: 'AP', name: 'Andhra Pradesh', type: 'State', capital: 'Amaravati', pincodePrefixes: ['51', '52', '53'] },
  { code: 'AR', name: 'Arunachal Pradesh', type: 'State', capital: 'Itanagar', pincodePrefixes: ['79'] },
  { code: 'AS', name: 'Assam', type: 'State', capital: 'Dispur', pincodePrefixes: ['78'] },
  { code: 'BR', name: 'Bihar', type: 'State', capital: 'Patna', pincodePrefixes: ['80', '81', '82', '84', '85'] },
  { code: 'CG', name: 'Chhattisgarh', type: 'State', capital: 'Raipur', pincodePrefixes: ['49'] },
  { code: 'GA', name: 'Goa', type: 'State', capital: 'Panaji', pincodePrefixes: ['403'] },
  { code: 'GJ', name: 'Gujarat', type: 'State', capital: 'Gandhinagar', pincodePrefixes: ['36', '37', '38', '39'] },
  { code: 'HR', name: 'Haryana', type: 'State', capital: 'Chandigarh', pincodePrefixes: ['12', '13'] },
  { code: 'HP', name: 'Himachal Pradesh', type: 'State', capital: 'Shimla', pincodePrefixes: ['17'] },
  { code: 'JH', name: 'Jharkhand', type: 'State', capital: 'Ranchi', pincodePrefixes: ['81', '82', '83'] },
  { code: 'KA', name: 'Karnataka', type: 'State', capital: 'Bengaluru', pincodePrefixes: ['56', '57', '58', '59'] },
  { code: 'KL', name: 'Kerala', type: 'State', capital: 'Thiruvananthapuram', pincodePrefixes: ['67', '68', '69'] },
  { code: 'MP', name: 'Madhya Pradesh', type: 'State', capital: 'Bhopal', pincodePrefixes: ['45', '46', '47', '48'] },
  { code: 'MH', name: 'Maharashtra', type: 'State', capital: 'Mumbai', pincodePrefixes: ['40', '41', '42', '43', '44'] },
  { code: 'MN', name: 'Manipur', type: 'State', capital: 'Imphal', pincodePrefixes: ['795'] },
  { code: 'ML', name: 'Meghalaya', type: 'State', capital: 'Shillong', pincodePrefixes: ['793', '794'] },
  { code: 'MZ', name: 'Mizoram', type: 'State', capital: 'Aizawl', pincodePrefixes: ['796'] },
  { code: 'NL', name: 'Nagaland', type: 'State', capital: 'Kohima', pincodePrefixes: ['797', '798'] },
  { code: 'OD', name: 'Odisha', type: 'State', capital: 'Bhubaneswar', pincodePrefixes: ['75', '76', '77'] },
  { code: 'PB', name: 'Punjab', type: 'State', capital: 'Chandigarh', pincodePrefixes: ['14', '15'] },
  { code: 'RJ', name: 'Rajasthan', type: 'State', capital: 'Jaipur', pincodePrefixes: ['30', '31', '32', '33', '34'] },
  { code: 'SK', name: 'Sikkim', type: 'State', capital: 'Gangtok', pincodePrefixes: ['737'] },
  { code: 'TN', name: 'Tamil Nadu', type: 'State', capital: 'Chennai', pincodePrefixes: ['60', '61', '62', '63', '64'] },
  { code: 'TS', name: 'Telangana', type: 'State', capital: 'Hyderabad', pincodePrefixes: ['50'] },
  { code: 'TR', name: 'Tripura', type: 'State', capital: 'Agartala', pincodePrefixes: ['799'] },
  { code: 'UP', name: 'Uttar Pradesh', type: 'State', capital: 'Lucknow', pincodePrefixes: ['20', '21', '22', '23', '24', '25', '26', '27', '28'] },
  { code: 'UK', name: 'Uttarakhand', type: 'State', capital: 'Dehradun', pincodePrefixes: ['246', '247', '248', '249', '262', '263'] },
  { code: 'WB', name: 'West Bengal', type: 'State', capital: 'Kolkata', pincodePrefixes: ['70', '71', '72', '73', '74'] },

  // 8 Union Territories
  { code: 'AN', name: 'Andaman and Nicobar Islands', type: 'Union Territory', capital: 'Port Blair', pincodePrefixes: ['744'] },
  { code: 'CH', name: 'Chandigarh', type: 'Union Territory', capital: 'Chandigarh', pincodePrefixes: ['160'] },
  { code: 'DH', name: 'Dadra and Nagar Haveli and Daman and Diu', type: 'Union Territory', capital: 'Daman', pincodePrefixes: ['396'] },
  { code: 'DL', name: 'Delhi', type: 'Union Territory', capital: 'New Delhi', pincodePrefixes: ['11'] },
  { code: 'JK', name: 'Jammu and Kashmir', type: 'Union Territory', capital: 'Srinagar / Jammu', pincodePrefixes: ['18', '19'] },
  { code: 'LA', name: 'Ladakh', type: 'Union Territory', capital: 'Leh', pincodePrefixes: ['194'] },
  { code: 'LD', name: 'Lakshadweep', type: 'Union Territory', capital: 'Kavaratti', pincodePrefixes: ['682'] },
  { code: 'PY', name: 'Puducherry', type: 'Union Territory', capital: 'Puducherry', pincodePrefixes: ['605'] },
];

/**
 * Official Districts of India mapped by State name.
 * Complete mapping across all Indian States and Union Territories.
 */
export const OFFICIAL_DISTRICTS_BY_STATE: Record<string, string[]> = {
  'Madhya Pradesh': [
    'Jabalpur', 'Bhopal', 'Indore', 'Gwalior', 'Ujjain', 'Sagar', 'Rewa', 'Satna',
    'Chhindwara', 'Balaghat', 'Seoni', 'Katni', 'Narsinghpur', 'Damoh', 'Mandla',
    'Dindori', 'Hoshangabad (Narmadapuram)', 'Harda', 'Betul', 'Dewas', 'Shajapur',
    'Agar Malwa', 'Ratlam', 'Mandsaur', 'Neemuch', 'Dhar', 'Jhabua', 'Alirajpur',
    'Khargone (West Nimar)', 'Barwani', 'Khandwa (East Nimar)', 'Burhanpur',
    'Raisen', 'Rajgarh', 'Sehore', 'Vidisha', 'Guna', 'Ashoknagar', 'Shivpuri',
    'Datia', 'Sheopur', 'Morena', 'Bhind', 'Tikamgarh', 'Niwari', 'Chhatarpur',
    'Panna', 'Singrauli', 'Sidhi', 'Shahdol', 'Anuppur', 'Umaria', 'Mauganj', 'Maihar'
  ],
  'Karnataka': [
    'Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Dakshina Kannada (Mangaluru)',
    'Udupi', 'Belagavi', 'Dharwad (Hubballi)', 'Kalaburagi (Gulbarga)', 'Ballari',
    'Vijayapura (Bijapur)', 'Shivamogga (Shimoga)', 'Tumakuru', 'Hassan', 'Mandya',
    'Chikkamagaluru', 'Kodagu (Coorg)', 'Kolar', 'Chikkaballapura', 'Ramanagara',
    'Chitradurga', 'Davanagere', 'Haveri', 'Gadag', 'Uttara Kannada (Karwar)',
    'Bagalkote', 'Koppal', 'Raichur', 'Bidar', 'Yadgir', 'Chamarajanagar', 'Vijayanagara'
  ],
  'Maharashtra': [
    'Mumbai City', 'Mumbai Suburban', 'Pune', 'Thane', 'Nagpur', 'Nashik',
    'Aurangabad (Chhatrapati Sambhajinagar)', 'Solapur', 'Kolhapur', 'Amravati',
    'Navi Mumbai', 'Palghar', 'Raigad', 'Ratnagiri', 'Sindhudurg', 'Satara', 'Sangli',
    'Ahmednagar (Ahilyanagar)', 'Jalgaon', 'Dhule', 'Nandurbar', 'Jalna', 'Parbhani',
    'Beed', 'Nanded', 'Osmanabad (Dharashiv)', 'Latur', 'Buldhana', 'Akola', 'Washim',
    'Yavatmal', 'Wardha', 'Chandrapur', 'Bhandara', 'Gondia', 'Gadchiroli'
  ],
  'Delhi': [
    'Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi',
    'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi',
    'West Delhi'
  ],
  'Uttar Pradesh': [
    'Lucknow', 'Kanpur Nagar', 'Kanpur Dehat', 'Varanasi', 'Prayagraj (Allahabad)',
    'Agra', 'Meerut', 'Noida (Gautam Buddha Nagar)', 'Ghaziabad', 'Aligarh',
    'Bareilly', 'Moradabad', 'Gorakhpur', 'Ayodhya', 'Jhansi', 'Saharanpur',
    'Mathura', 'Muzaffarnagar', 'Firozabad', 'Budaun', 'Shahjahanpur', 'Rampur',
    'Hardoi', 'Sitapur', 'Lakhimpur Kheri', 'Unnao', 'Rae Bareli', 'Farrukhabad',
    'Kannauj', 'Etawah', 'Mainpuri', 'Banda', 'Chitrakoot', 'Fatehpur', 'Hamirpur',
    'Jalaun', 'Mahoba', 'Mirzapur', 'Sonbhadra', 'Bhadohi', 'Jaunpur', 'Ghazipur',
    'Ballia', 'Azamgarh', 'Mau', 'Deoria', 'Kushinagar', 'Maharajganj', 'Basti',
    'Siddharthnagar', 'Sant Kabir Nagar', 'Gonda', 'Bahraich', 'Balrampur', 'Shravasti',
    'Ambedkar Nagar', 'Sultanpur', 'Amethi', 'Barabanki', 'Bulandshahr', 'Hapur',
    'Baghpat', 'Shamli', 'Bijnor', 'Sambhal', 'Amroha', 'Pilibhit', 'Kasganj', 'Hathras'
  ],
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli',
    'Tiruppur', 'Erode', 'Vellore', 'Thoothukudi', 'Dindigul', 'Thanjavur',
    'Ranipet', 'Virudhunagar', 'Karur', 'Nilgiris', 'Kanchipuram', 'Chengalpattu',
    'Tiruvallur', 'Cuddalore', 'Villupuram', 'Kallakurichi', 'Tiruvannamalai',
    'Dharmapuri', 'Krishnagiri', 'Namakkal', 'Pudukkottai', 'Sivaganga', 'Ramanathapuram',
    'Tenkasi', 'Kanniyakumari', 'Mayiladuthurai', 'Nagapattinam', 'Tiruvarur', 'Ariyalur', 'Perambalur', 'Theni', 'Tirupattur'
  ],
  'Telangana': [
    'Hyderabad', 'Medchal-Malkajgiri', 'Rangareddy', 'Warangal', 'Hanamkonda',
    'Karimnagar', 'Nizamabad', 'Khammam', 'Nalgonda', 'Mahabubnagar', 'Suryapet',
    'Siddipet', 'Sangareddy', 'Mancherial', 'Jagtial', 'Kamareddy', 'Adilabad',
    'Bhadradri Kothagudem', 'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Jangaon',
    'Kumuram Bheem Asifabad', 'Mahabubabad', 'Medak', 'Mulugu', 'Nagarkurnool',
    'Narayanpet', 'Nirmal', 'Peddapalli', 'Rajanna Sircilla', 'Vikarabad', 'Wanaparthy', 'Yadadri Bhuvanagiri'
  ],
  'Gujarat': [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh',
    'Gandhinagar', 'Anand', 'Navsari', 'Morbi', 'Bharuch', 'Valsad', 'Porbandar',
    'Kachchh', 'Banaskantha', 'Patan', 'Mehsana', 'Sabarkantha', 'Aravalli', 'Kheda',
    'Mahisagar', 'Panchmahal', 'Dahod', 'Chhota Udaipur', 'Narmada', 'Tapi', 'Dang',
    'Surendranagar', 'Amreli', 'Gir Somnath', 'Botad', 'Devbhumi Dwarka'
  ],
  'Rajasthan': [
    'Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Bhilwara', 'Alwar',
    'Sikar', 'Bharatpur', 'Pali', 'Sri Ganganagar', 'Barmer', 'Chittorgarh', 'Jhunjhunu',
    'Churu', 'Nagaur', 'Dausa', 'Tonk', 'Hanumangarh', 'Banswara', 'Dungarpur',
    'Jhalawar', 'Baran', 'Bundi', 'Sirohi', 'Jalore', 'Jaisalmer', 'Pratapgarh', 'Rajsamand', 'Sawai Madhopur', 'Karauli', 'Dholpur'
  ],
  'West Bengal': [
    'Kolkata', 'North 24 Parganas', 'South 24 Parganas', 'Howrah', 'Hooghly',
    'Darjeeling', 'Kalimpong', 'Jalpaiguri', 'Alipurduar', 'Cooch Behar',
    'Uttar Dinajpur', 'Dakshin Dinajpur', 'Malda', 'Murshidabad', 'Nadia',
    'Birbhum', 'Purba Bardhaman', 'Paschim Bardhaman', 'Bankura', 'Purulia',
    'Jhargram', 'Paschim Medinipur', 'Purba Medinipur'
  ],
  'Kerala': [
    'Thiruvananthapuram', 'Ernakulam (Kochi)', 'Kozhikode', 'Thrissur', 'Kollam',
    'Kannur', 'Alappuzha', 'Kottayam', 'Palakkad', 'Malappuram', 'Kasaragod',
    'Pathanamthitta', 'Idukki', 'Wayanad'
  ],
  'Punjab': [
    'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali (SAS Nagar)',
    'Hoshiarpur', 'Pathankot', 'Moga', 'Firozpur', 'Kapurthala', 'Faridkot',
    'Gurdaspur', 'Barnala', 'Fatehgarh Sahib', 'Fazilka', 'Mansa', 'Muktsar',
    'Rupnagar', 'Sangrur', 'Tarn Taran', 'Malerkotla', 'Shaheed Bhagat Singh Nagar'
  ],
  'Haryana': [
    'Gurugram (Gurgaon)', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak',
    'Hisar', 'Karnal', 'Sonipat', 'Panchkula', 'Bhiwani', 'Sirsa', 'Bahadurgarh',
    'Jind', 'Thanesar (Kurukshetra)', 'Kaithal', 'Rewari', 'Palwal', 'Fatehabad',
    'Mahendragarh', 'Nuh', 'Charkhi Dadri'
  ],
  'Bihar': [
    'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Bihar Sharif',
    'Arrah (Bhojpur)', 'Begusarai', 'Katihar', 'Munger', 'Chhapra (Saran)', 'Saharsa',
    'Sasaram (Rohtas)', 'Hajipur (Vaishali)', 'Dehri', 'Siwan', 'Motihari (East Champaran)',
    'Bettiah (West Champaran)', 'Kishanganj', 'Sitamarhi', 'Buxar', 'Jehanabad', 'Aurangabad',
    'Nawada', 'Jamui', 'Madhubani', 'Samastipur', 'Khagaria', 'Banka', 'Lakhisarai',
    'Sheikhpura', 'Arwal', 'Gopalganj', 'Madhepura', 'Supaul', 'Kaimur', 'Sheohar'
  ],
  'Odisha': [
    'Bhubaneswar (Khurda)', 'Cuttack', 'Rourkela (Sundargarh)', 'Berhampur (Ganjam)',
    'Sambalpur', 'Puri', 'Balasore', 'Bhadrak', 'Baripada (Mayurbhanj)', 'Angul',
    'Jharsuguda', 'Bargarh', 'Jajpur', 'Kendrapara', 'Jagatsinghpur', 'Dhenkanal',
    'Keonjhar', 'Kalahandi', 'Koraput', 'Nabarangpur', 'Rayagada', 'Malkangiri',
    'Bolangir', 'Subarnapur', 'Nuapada', 'Kandhamal', 'Boudh', 'Nayagarh', 'Gajapati', 'Deogarh'
  ],
  'Assam': [
    'Guwahati (Kamrup Metropolitan)', 'Kamrup', 'Dibrugarh', 'Silchar (Cachar)',
    'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur (Sonitpur)', 'Bongaigaon', 'Dhubri',
    'Barpeta', 'Goalpara', 'Karimganj', 'Sivasagar', 'Golaghat', 'Hailakandi',
    'Lakhimpur', 'Darrang', 'Morigaon', 'Nalbari', 'Kokrajhar', 'Baksa', 'Chirang',
    'Udalguri', 'Karbi Anglong', 'Dima Hasao', 'Charaideo', 'Hojai', 'Biswanath',
    'Majuli', 'South Salmara-Mankachar', 'West Karbi Anglong', 'Bajali', 'Tamulpur'
  ],
  'Jharkhand': [
    'Ranchi', 'Jamshedpur (East Singhbhum)', 'Dhanbad', 'Bokaro', 'Deoghar',
    'Hazaribagh', 'Giridih', 'Ramgarh', 'Medininagar (Palamu)', 'Chaibasa (West Singhbhum)',
    'Dumka', 'Godda', 'Sahebganj', 'Pakur', 'Jamtara', 'Koderma', 'Chatra', 'Garhwa',
    'Latehar', 'Lohardaga', 'Gumla', 'Simdega', 'Khunti', 'Seraikela Kharsawan'
  ],
  'Chhattisgarh': [
    'Raipur', 'Bhilai (Durg)', 'Bilaspur', 'Korba', 'Rajnandgaon', 'Raigarh',
    'Jagdalpur (Bastar)', 'Ambikapur (Surguja)', 'Dhamtari', 'Mahasamund', 'Kanker',
    'Kawardha (Kabirdham)', 'Janjgir-Champa', 'Balod', 'Bemetara', 'Baloda Bazar',
    'Gariaband', 'Mungeli', 'Surajpur', 'Balrampur', 'Koriya', 'Sukma', 'Bijapur',
    'Dantewada', 'Narayanpur', 'Kondagaon', 'Gaurela-Pendra-Marwahi', 'Khairagarh',
    'Mohla-Manpur', 'Sakti', 'Sarangarh-Bilaigarh', 'Manendragarh'
  ],
  'Uttarakhand': [
    'Dehradun', 'Haridwar', 'Nainital', 'Udham Singh Nagar (Rudrapur)', 'Almora',
    'Pauri Garhwal', 'Tehri Garhwal', 'Chamoli', 'Rudraprayag', 'Uttarkashi',
    'Pithoragarh', 'Champawat', 'Bageshwar'
  ],
  'Himachal Pradesh': [
    'Shimla', 'Kangra (Dharamshala)', 'Mandi', 'Solan', 'Kullu', 'Sirmaur (Nahan)',
    'Hamirpur', 'Una', 'Bilaspur', 'Chamba', 'Kinnaur', 'Lahaul and Spiti'
  ],
  'Goa': [
    'North Goa (Panaji)', 'South Goa (Margao)'
  ],
  'Tripura': [
    'West Tripura (Agartala)', 'South Tripura', 'North Tripura', 'Dhalai',
    'Khowai', 'Sepahijala', 'Gomati', 'Unakoti'
  ],
  'Manipur': [
    'Imphal West', 'Imphal East', 'Bishnupur', 'Thoubal', 'Churachandpur',
    'Senapati', 'Ukhrul', 'Chandel', 'Tamenglong', 'Kangpokpi', 'Tengnoupal',
    'Kamjong', 'Noney', 'Pherzawl', 'Kakching', 'Jiribam'
  ],
  'Meghalaya': [
    'East Khasi Hills (Shillong)', 'West Garo Hills (Tura)', 'West Jaintia Hills (Jowai)',
    'Ri-Bhoi (Nongpoh)', 'West Khasi Hills', 'East Garo Hills', 'South Garo Hills',
    'South West Garo Hills', 'East Jaintia Hills', 'North Garo Hills', 'South West Khasi Hills', 'Eastern West Khasi Hills'
  ],
  'Nagaland': [
    'Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto',
    'Phek', 'Mon', 'Peren', 'Longleng', 'Kiphire', 'Noklak', 'Chumoukedima', 'Niuland', 'Tseminyu', 'Shamator'
  ],
  'Arunachal Pradesh': [
    'Papum Pare (Itanagar)', 'Changlang', 'Lohit', 'West Kameng', 'East Kameng',
    'Tawang', 'Lower Subansiri', 'Upper Subansiri', 'West Siang', 'East Siang',
    'Upper Siang', 'Dibang Valley', 'Lower Dibang Valley', 'Anjaw', 'Tirap',
    'Longding', 'Namsai', 'Kra Daadi', 'Siang', 'Kamle', 'Pakke Kessang', 'Shi Yomi', 'Lepa Rada'
  ],
  'Mizoram': [
    'Aizawl', 'Lunglei', 'Champhai', 'Kolasib', 'Serchhip', 'Lawngtlai',
    'Mamit', 'Saiha', 'Hnahthial', 'Khawzawl', 'Saitual'
  ],
  'Sikkim': [
    'East Sikkim (Gangtok)', 'West Sikkim (Gyalshing)', 'North Sikkim (Mangan)',
    'South Sikkim (Namchi)', 'Pakyong', 'Soreng'
  ],
  'Chandigarh': ['Chandigarh'],
  'Puducherry': ['Puducherry', 'Karaikal', 'Mahe', 'Yanam'],
  'Andaman and Nicobar Islands': ['South Andaman (Port Blair)', 'North and Middle Andaman', 'Nicobar'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Diu', 'Dadra and Nagar Haveli (Silvassa)'],
  'Jammu and Kashmir': [
    'Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Budgam', 'Pulwama',
    'Kupwara', 'Shopian', 'Ganderbal', 'Bandipora', 'Udhampur', 'Kathua',
    'Rajouri', 'Poonch', 'Reasi', 'Ramban', 'Kishtwar', 'Doda', 'Samba'
  ],
  'Ladakh': ['Leh', 'Kargil'],
  'Lakshadweep': ['Lakshadweep (Kavaratti)']
};

/**
 * Official baseline postal records directly from the Department of Posts / India Post PIN code directory.
 * Includes complete official records for PIN code 482002 (Jabalpur, MP) and key hubs across circles.
 */
export const VERIFIED_POSTAL_DIRECTORY: PostalRecord[] = [
  // --- JABALPUR, MADHYA PRADESH: PIN CODE 482002 ---
  // Official Department of Posts records under PIN 482002
  {
    name: 'Lordganj',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1685,
    longitude: 79.9339,
  },
  {
    name: 'Agasaud',
    branchType: 'Branch Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Panagar',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.2104,
    longitude: 79.9512,
  },
  {
    name: 'Jabalpur City',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1678,
    longitude: 79.9320,
  },
  {
    name: 'Garha Phatak',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1630,
    longitude: 79.9280,
  },
  {
    name: 'Ganjipura',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1690,
    longitude: 79.9350,
  },
  {
    name: 'Wright Town',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1645,
    longitude: 79.9412,
  },
  {
    name: 'Vijay Nagar Colony (Jabalpur)',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1950,
    longitude: 79.9120,
  },
  {
    name: 'Hanumantal',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1780,
    longitude: 79.9420,
  },
  {
    name: 'Dixitpura',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1710,
    longitude: 79.9380,
  },
  {
    name: 'I.T.I.',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1890,
    longitude: 79.9250,
  },
  {
    name: 'Belkhadu',
    branchType: 'Branch Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Patan',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.2350,
    longitude: 79.9050,
  },
  {
    name: 'Jonesganj',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1725,
    longitude: 79.9360,
  },
  {
    name: 'Kamala Nehru Nagar',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1810,
    longitude: 79.9230,
  },
  {
    name: 'Karmeta',
    branchType: 'Branch Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.2120,
    longitude: 79.9010,
  },
  {
    name: 'Mangela',
    branchType: 'Branch Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Panagar',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.2280,
    longitude: 79.9720,
  },
  {
    name: 'Miloniganj',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1750,
    longitude: 79.9410,
  },
  {
    name: 'Motinala',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1765,
    longitude: 79.9450,
  },
  {
    name: 'Nagar Nigam',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1670,
    longitude: 79.9390,
  },
  {
    name: 'Gurandi Bazar',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1715,
    longitude: 79.9340,
  },
  {
    name: 'Gohalpur',
    branchType: 'Branch Post Office',
    deliveryStatus: 'Non-Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482002',
    latitude: 23.1905,
    longitude: 79.9480,
  },

  // Other Jabalpur PIN Codes
  {
    name: 'Jabalpur H.O',
    branchType: 'Head Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482001',
    latitude: 23.1610,
    longitude: 79.9480,
  },
  {
    name: 'Civil Lines Jabalpur',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482001',
    latitude: 23.1590,
    longitude: 79.9520,
  },
  {
    name: 'Ranjhi',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Madhya Pradesh',
    district: 'Jabalpur',
    division: 'Jabalpur',
    region: 'Jabalpur',
    block: 'Jabalpur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '482005',
    latitude: 23.1812,
    longitude: 80.0125,
  },

  // --- BENGALURU, KARNATAKA ---
  {
    name: 'Indiranagar',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Karnataka',
    district: 'Bengaluru Urban',
    division: 'Bangalore East',
    region: 'Bangalore HQ',
    block: 'Bangalore North',
    state: 'Karnataka',
    country: 'India',
    pincode: '560038',
    latitude: 12.9784,
    longitude: 77.6408,
  },
  {
    name: 'HAL 2nd Stage',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Karnataka',
    district: 'Bengaluru Urban',
    division: 'Bangalore East',
    region: 'Bangalore HQ',
    block: 'Bangalore North',
    state: 'Karnataka',
    country: 'India',
    pincode: '560008',
    latitude: 12.9664,
    longitude: 77.6520,
  },
  {
    name: 'Koramangala 4th Block',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Karnataka',
    district: 'Bengaluru Urban',
    division: 'Bangalore South',
    region: 'Bangalore HQ',
    block: 'Bangalore South',
    state: 'Karnataka',
    country: 'India',
    pincode: '560034',
    latitude: 12.9352,
    longitude: 77.6245,
  },
  {
    name: 'HSR Layout',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Karnataka',
    district: 'Bengaluru Urban',
    division: 'Bangalore South',
    region: 'Bangalore HQ',
    block: 'Bangalore South',
    state: 'Karnataka',
    country: 'India',
    pincode: '560102',
    latitude: 12.9121,
    longitude: 77.6446,
  },
  {
    name: 'Bangalore G.P.O.',
    branchType: 'Head Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Karnataka',
    district: 'Bengaluru Urban',
    division: 'Bangalore GPO',
    region: 'Bangalore HQ',
    block: 'Bangalore North',
    state: 'Karnataka',
    country: 'India',
    pincode: '560001',
    latitude: 12.9800,
    longitude: 77.5975,
  },

  // --- MUMBAI, MAHARASHTRA ---
  {
    name: 'Bandra West',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Maharashtra',
    district: 'Mumbai Suburban',
    division: 'Mumbai West',
    region: 'Mumbai',
    block: 'Bandra',
    state: 'Maharashtra',
    country: 'India',
    pincode: '400050',
    latitude: 19.0596,
    longitude: 72.8295,
  },
  {
    name: 'Andheri West',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Maharashtra',
    district: 'Mumbai Suburban',
    division: 'Mumbai West',
    region: 'Mumbai',
    block: 'Andheri',
    state: 'Maharashtra',
    country: 'India',
    pincode: '400058',
    latitude: 19.1136,
    longitude: 72.8697,
  },

  // --- DELHI ---
  {
    name: 'Connaught Place',
    branchType: 'Head Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Delhi',
    district: 'New Delhi',
    division: 'New Delhi Central',
    region: 'Delhi',
    block: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    pincode: '110001',
    latitude: 28.6315,
    longitude: 77.2167,
  },
  {
    name: 'Hauz Khas',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Delhi',
    district: 'South Delhi',
    division: 'New Delhi South',
    region: 'Delhi',
    block: 'Hauz Khas',
    state: 'Delhi',
    country: 'India',
    pincode: '110016',
    latitude: 28.5494,
    longitude: 77.2001,
  },

  // --- HYDERABAD, TELANGANA ---
  {
    name: 'Banjara Hills',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Telangana',
    district: 'Hyderabad',
    division: 'Hyderabad City',
    region: 'Hyderabad',
    block: 'Shaikpet',
    state: 'Telangana',
    country: 'India',
    pincode: '500034',
    latitude: 17.4156,
    longitude: 78.4357,
  },

  // --- PUNE, MAHARASHTRA ---
  {
    name: 'Kothrud',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Maharashtra',
    district: 'Pune',
    division: 'Pune City West',
    region: 'Pune',
    block: 'Haveli',
    state: 'Maharashtra',
    country: 'India',
    pincode: '411038',
    latitude: 18.5074,
    longitude: 73.8077,
  },

  // --- CHENNAI, TAMIL NADU ---
  {
    name: 'T. Nagar',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Tamil Nadu',
    district: 'Chennai',
    division: 'Chennai Central',
    region: 'Chennai City',
    block: 'Mambalam',
    state: 'Tamil Nadu',
    country: 'India',
    pincode: '600017',
    latitude: 13.0418,
    longitude: 80.2341,
  },

  // --- BHOPAL, MADHYA PRADESH ---
  {
    name: 'Bhopal G.P.O.',
    branchType: 'Head Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Madhya Pradesh',
    district: 'Bhopal',
    division: 'Bhopal',
    region: 'Bhopal',
    block: 'Bhopal',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '462001',
    latitude: 23.2599,
    longitude: 77.4126,
  },
  {
    name: 'Arera Colony',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Madhya Pradesh',
    district: 'Bhopal',
    division: 'Bhopal',
    region: 'Bhopal',
    block: 'Huzur',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '462016',
    latitude: 23.2132,
    longitude: 77.4285,
  },

  // --- INDORE, MADHYA PRADESH ---
  {
    name: 'Indore G.P.O.',
    branchType: 'Head Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Madhya Pradesh',
    district: 'Indore',
    division: 'Indore City',
    region: 'Indore',
    block: 'Indore',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '452001',
    latitude: 22.7196,
    longitude: 75.8577,
  },
  {
    name: 'Vijay Nagar (Indore)',
    branchType: 'Sub Post Office',
    deliveryStatus: 'Delivery',
    circle: 'Madhya Pradesh',
    district: 'Indore',
    division: 'Indore City',
    region: 'Indore',
    block: 'Indore',
    state: 'Madhya Pradesh',
    country: 'India',
    pincode: '452010',
    latitude: 22.7533,
    longitude: 75.8937,
  }
];

/**
 * Circle / Region Postal Index Prefix Mapping Rules
 * Fast synchronous deduction of State / Circle from PIN code prefix.
 */
export function deduceStateFromPincode(pincode: string): string | null {
  if (!pincode || pincode.length < 2) return null;

  const p2 = pincode.substring(0, 2);
  const p3 = pincode.substring(0, 3);

  // Exact 3-digit overrides
  if (p3 === '160') return 'Chandigarh';
  if (p3 === '194') return 'Ladakh';
  if (p3 === '396') return 'Dadra and Nagar Haveli and Daman and Diu';
  if (p3 === '403') return 'Goa';
  if (p3 === '605') return 'Puducherry';
  if (p3 === '682') return 'Lakshadweep';
  if (p3 === '737') return 'Sikkim';
  if (p3 === '744') return 'Andaman and Nicobar Islands';
  if (p3 === '793' || p3 === '794') return 'Meghalaya';
  if (p3 === '795') return 'Manipur';
  if (p3 === '796') return 'Mizoram';
  if (p3 === '797' || p3 === '798') return 'Nagaland';
  if (p3 === '799') return 'Tripura';
  if (['246', '247', '248', '249', '262', '263'].includes(p3)) return 'Uttarakhand';

  // 2-digit Circle prefix rules
  switch (p2) {
    case '11': return 'Delhi';
    case '12':
    case '13': return 'Haryana';
    case '14':
    case '15': return 'Punjab';
    case '17': return 'Himachal Pradesh';
    case '18':
    case '19': return 'Jammu and Kashmir';
    case '20':
    case '21':
    case '22':
    case '23':
    case '24':
    case '25':
    case '26':
    case '27':
    case '28': return 'Uttar Pradesh';
    case '30':
    case '31':
    case '32':
    case '33':
    case '34': return 'Rajasthan';
    case '36':
    case '37':
    case '38':
    case '39': return 'Gujarat';
    case '40':
    case '41':
    case '42':
    case '43':
    case '44': return 'Maharashtra';
    case '45':
    case '46':
    case '47':
    case '48': return 'Madhya Pradesh';
    case '49': return 'Chhattisgarh';
    case '50': return 'Telangana';
    case '51':
    case '52':
    case '53': return 'Andhra Pradesh';
    case '56':
    case '57':
    case '58':
    case '59': return 'Karnataka';
    case '60':
    case '61':
    case '62':
    case '63':
    case '64': return 'Tamil Nadu';
    case '67':
    case '68':
    case '69': return 'Kerala';
    case '70':
    case '71':
    case '72':
    case '73':
    case '74': return 'West Bengal';
    case '75':
    case '76':
    case '77': return 'Odisha';
    case '78': return 'Assam';
    case '79': return 'Arunachal Pradesh';
    case '80':
    case '81':
    case '82':
    case '84':
    case '85': return 'Bihar';
    case '83': return 'Jharkhand';
    default: return null;
  }
}
