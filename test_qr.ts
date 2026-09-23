import QRCode from 'qrcode';

async function test() {
  const url = await QRCode.toDataURL("TEST-SKU");
  console.log(url.substring(0, 50));
}
test();
