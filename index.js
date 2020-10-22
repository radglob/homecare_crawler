const puppeteer = require('puppeteer');
const fs = require('fs');
const fastcsv = require('fast-csv')
const ws = fs.createWriteStream('out.csv')

const ZIP_CODES = fs.readFileSync('./zip_codes.txt', { encoding: 'utf-8'}).split('\n');
const BASE_URL = 'https://www.carepathways.com/';

const getBusinessName = async (page) => {
  try {
    const businessName = await page.$eval('div.main-row > div > div > div > h1', el => el.innerHTML);
    return businessName;
  } catch(e) {
    return 'N/A';
  }
}

const getAddress = async (page) => {
  try {
    const address = await page.$eval('div.main-row > div > div > div > h3 > small', el => el.innerText.split(',')[0])
    return address
  } catch(e) {
    return 'N/A'
  }
}

const getPhoneNumber = async (page) => {
  try {
    const phoneNumber = await page.$eval('#displayPhone', el => el.innerText.split('\n')[1])
    return phoneNumber
  } catch(e) {
    return 'N/A'
  }
}

const getServiceAreas = async (page) => {
  try {
    let serviceAreas = await page.$eval('div.main-row > div > div > div > p', el => el.innerText.split(':')[0])
    serviceAreas = ['King', 'Pierce', 'Kitsap', 'Skagit', 'Snohomish', 'Thurston'].reduce((acc, k) => ({...acc, [k]: serviceAreas.indexOf(k) !== -1 }), {})
    return serviceAreas
  } catch(e) {
    return {
      King: 'N/A',
      Pierce: 'N/A',
      Skagit: 'N/A',
      Snohomish: 'N/A',
      Thurston: 'N/A',
      Kitsap: 'N/A'
    }
  }
}

const getMinimumHours = async (page) => {
  try {
    const minimumHours = await page.$eval('div.main-row > div > div > div > div > div:nth-child(3) > div:nth-child(2)', el => parseInt(el.innerText, 10))
    return minimumHours
  } catch(e) {
    return 'N/A'
  }
}

const getYearsInBusiness = async (page) => {
  try {
    const yearsInBusiness = await page.$eval('div.main-row > div > div > div > div > div:nth-child(4) > div:nth-child(2)', el => el.innerText === 'NA' ? 'N/A' : parseInt(el.innerText, 10))
    return yearsInBusiness
  } catch(e) {
    return 'N/A'
  }
}

const getPrivatePay = async (page) => {
  try {
    const privatePay = await page.$eval('div.main-row > div > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > i', el => el.classList.contains('fa-check-circle'))
    return privatePay
  } catch(e) {
    return 'N/A'
  }
}

const getLTC = async (page) => {
  try {
    const LTC = await page.$eval('div.main-row > div > div > div > div:nth-child(2) > div:nth-child(3) > div:nth-child(2) > i', el => el.classList.contains('fa-check-circle'))
    return LTC
  } catch(e) {
    return 'N/A'
  }
}

const getMedicaid = async (page) => {
  try {
    const medicaid = await page.$eval('div.main-row > div > div > div > div:nth-child(2) > div:nth-child(4) > div:nth-child(2) > i', el => el.classList.contains('fa-check-circle'))
    return medicaid
  } catch(e) {
    return 'N/A'
  }
}

const scrapePage = async (page, href, zipCode) => {
  try {
    await page.goto(href, {
      waitUntil: 'networkidle0'
    });

    const businessName = await getBusinessName(page)
    const address = await getAddress(page)
    const phoneNumber = await getPhoneNumber(page)
    const serviceAreas = await getServiceAreas(page)
    const minimumHours = await getMinimumHours(page)
    const yearsInBusiness = await getYearsInBusiness(page)
    const privatePay = await getPrivatePay(page)
    const LTC = await getLTC(page)
    const medicaid = await getMedicaid(page)

    console.log(`Processed ${href}`)

    return {
      'Company Name': businessName,
      'Address': address,
      'Zip Code': zipCode,
      'email': 'N/A',
      'phone': phoneNumber,
      ...serviceAreas,
      'Minimum Hours': minimumHours,
      'Years in Business': yearsInBusiness,
      'Private Pay': privatePay,
      LTC,
      'Medicaid': medicaid
    }
  } catch(e) {
    console.error(e)
    console.error(`Couldn't access ${href}`);
  }
}

const handleZipCode = async (browser, zipCode) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(BASE_URL, { waituntil: 'domcontentloaded' })
  await page.type('#zipcode', zipCode);
  await page.keyboard.press('Enter');
  await page.waitForNavigation();

  let links = await page.$$eval('#homecare .small-12 a', as => as.map(a => a.href));
  urls = links.filter(href => href.startsWith(BASE_URL));
  const data = []
  for (let url of urls) {
    const d = await scrapePage(page, url, zipCode)
    data.push(d)
  }
  await page.close();
  return data
}

(async () => {
  const browser = await puppeteer.launch();

  let info = []
  
  for (let zipCode of ZIP_CODES) {
    try {
      const i = await handleZipCode(browser, zipCode)
      info.push(i)
    } catch(e) {
      console.error(`Failed to crawl ${zipCode}`)
    }
  }
  await browser.close()
  info = [].concat(...info)
  fastcsv.write(info, { headers: true }).pipe(ws)
})()