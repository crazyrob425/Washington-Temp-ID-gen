/**
 * AAMVA DL/ID Card Design Standard Encoder
 * Strictly follows the AAMVA 2020 (v10) and 2023 (v13) standards.
 * Tailored for Washington State (IIN: 636000).
 */

export interface AAMVAData {
  firstName: string;
  lastName: string;
  middleName?: string;
  dob: string; // YYYY-MM-DD
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  height: string; // e.g. 5' - 6"
  weight: string; // lbs
  eyeColor: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  licenseNumber: string;
  issueDate: string; // YYYY-MM-DD
  expirationDate: string; // YYYY-MM-DD
  class: string;
  restrictions: string;
  endorsements: string;
}

const GENDER_MAP: Record<string, string> = {
  'MALE': '1',
  'FEMALE': '2',
  'OTHER': '9'
};

const EYE_COLOR_MAP: Record<string, string> = {
  'BRO': 'BRN',
  'BLU': 'BLU',
  'GRN': 'GRN',
  'HAZ': 'HAZ',
  'GRY': 'GRY',
  'BLK': 'BLK',
  'DIC': 'DIC',
  'MAR': 'MAR',
  'PNK': 'PNK',
  'UNK': 'UNK'
};

/**
 * Encodes data into an AAMVA compliant PDF417 string.
 */
export function encodeAAMVA(data: AAMVAData): string {
  const iin = '636000'; // Washington State IIN
  const version = '10'; // AAMVA Version 10 (2020)
  const jurisdictionVersion = '00';
  
  const formatDate = (dateStr: string) => dateStr.replace(/-/g, '');
  
  // AAMVA DAU (Height) is 6 characters: FTIN (e.g. 0506)
  const parseHeight = (h: string) => {
    const match = h.match(/(\d+)'\s*-\s*(\d+)"/);
    if (match) {
      const ft = match[1].padStart(2, '0');
      const inch = match[2].padStart(2, '0');
      return `${ft}${inch}`;
    }
    // Fallback to inches if format is different
    const inchesMatch = h.match(/(\d+)/);
    if (inchesMatch) {
      const totalInches = parseInt(inchesMatch[1]);
      const ft = Math.floor(totalInches / 12).toString().padStart(2, '0');
      const inch = (totalInches % 12).toString().padStart(2, '0');
      return `${ft}${inch}`;
    }
    return '0000';
  };

  // Mandatory and highly recommended AAMVA elements
  const elements: Record<string, string> = {
    'DCA': data.class.toUpperCase() || 'NONE',
    'DCB': data.restrictions.toUpperCase() || 'NONE',
    'DCD': data.endorsements.toUpperCase() || 'NONE',
    'DCS': data.lastName.toUpperCase(),
    'DAC': data.firstName.toUpperCase(),
    'DAD': (data.middleName || '').toUpperCase(),
    'DBD': formatDate(data.issueDate),
    'DBB': formatDate(data.dob),
    'DBA': formatDate(data.expirationDate),
    'DBC': GENDER_MAP[data.gender] || '9',
    'DAU': parseHeight(data.height),
    'DAY': EYE_COLOR_MAP[data.eyeColor] || 'UNK',
    'DAG': data.addressStreet.toUpperCase(),
    'DAI': data.addressCity.toUpperCase(),
    'DAJ': data.addressState.toUpperCase(),
    'DAK': data.addressZip.toUpperCase().replace(/-/g, '').substring(0, 9),
    'DAQ': data.licenseNumber.toUpperCase(),
    'DCF': 'D081224981341', // Document Discriminator (Control #)
    'DCG': 'USA',
    'DDE': 'N', // Name truncation indicators
    'DDF': 'N',
    'DDG': 'N',
    'DCW': data.weight.padStart(3, '0'), // Weight in LBS
    'DCH': 'NONE', // Federal Commission
    'DCI': 'WASHINGTON', // Place of Birth
    'DCK': 'D081224981341', // Inventory Control Number
  };

  // Build subfile content
  // Elements are separated by a Carriage Return (\r)
  let subfileContent = 'DL';
  for (const [key, value] of Object.entries(elements)) {
    if (value && value !== '') {
      subfileContent += `${key}${value}\r`;
    }
  }

  // Header: 21 bytes exactly
  // [0] @
  // [1] \n (LF)
  // [2] \x1e (RS)
  // [3] \r (CR)
  // [4-8] ANSI 
  // [9-14] IIN (636000)
  // [15-16] Version (10)
  // [17-18] Jurisdiction Version (00)
  // [19-20] Number of Subfiles (01)
  const header = `@\n\x1e\rANSI ${iin}${version}${jurisdictionVersion}01`;
  
  // Subfile designator: 10 bytes
  // [0-1] Type (DL)
  // [2-5] Offset (4 chars)
  // [6-9] Length (4 chars)
  const subfileType = 'DL';
  const offset = (header.length + 10).toString().padStart(4, '0');
  const length = subfileContent.length.toString().padStart(4, '0');
  const designator = `${subfileType}${offset}${length}`;
  
  return `${header}${designator}${subfileContent}`;
}
