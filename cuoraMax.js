const { raw } = require('body-parser');
const { SerialPort } = require('serialport');

/**
 * Helpers para construir y parsear tramas según CUORA MAX v7
 * Protocolo: [ADDR (1 byte numeric)][FUNC (1 byte numeric)][DATA (ASCII bytes...)] [CRC (1 byte XOR)]
 */

// Lista puertos COM
async function listPorts() {
    return await SerialPort.list(); // solo para inicializar en algunas plataformas
}

// Construye la trama: addrNumber (0..99), funcNumber (0..255), dataString (ASCII)
function buildFrame(addr, func, data = '') {
  if (typeof addr !== 'number' || typeof func !== 'number') throw new Error('addr y func deben ser números');
  const dataBuf = Buffer.from(data, 'ascii'); // data ASCII según protocolo
  const buf = Buffer.alloc(2 + dataBuf.length + 1); // addr + func + data + crc
  buf[0] = addr & 0xFF;
  buf[1] = func & 0xFF;
  dataBuf.copy(buf, 2);
  // calcula XOR sobre addr, func y data
  let crc = 0;
  for (let i = 0; i < 2 + dataBuf.length; i++) crc ^= buf[i];
  buf[2 + dataBuf.length] = crc & 0xFF;
  return buf;
}

// Parsear respuesta: devuelve { addr, func, data: Buffer, crcValid }
function parseFrame(buf) {
  if (!Buffer.isBuffer(buf)/*  || buf.length < 3 */) return { ok: false, reason: 'trama demasiado corta', buf: buf };
  const addr = buf[0];
  const func = buf[1];
  const crcRecv = buf[buf.length - 1];
  const data = buf.slice(2, buf.length - 1);
  let crcCalc = 0;
  for (let i = 0; i < buf.length - 1; i++) crcCalc ^= buf[i];
  return { ok: true, addr, func, data, crcRecv, crcCalc, crcValid: (crcRecv === (crcCalc & 0xFF)) };
}

// Ensamblar PLU extendido (función 61) - hay muchísimos campos; aquí doy un constructor básico para los campos primarios.
// Debes ajustar los campos extra según necesidades del PLU en tu comercio.
// Orden según doc (resumido): PLU(6) Name(18) Price1(6) Range1(6) Price2(6) Range2(6) ... Codigo PLU(6) Sector(2) DiasVto(4) Tipo(1) Tara(4) ...
function buildPluExtended(data) {
    function padNum(n, len) {
        return String(n ?? "").padStart(len, "0").slice(0, len);
    }
    function padText(t, len) {
        return String(t ?? "").padEnd(len, " ").slice(0, len);
    }
    //console.log(data.price);
    const parts = [];
    parts.push(padNum(data.plu, 4));                          // Número de PLU (4 dígitos)
    parts.push("2");                                          // Versión (fijo en "2")
    parts.push(padText(data.name, 18));                       // Nombre (18 caracteres)
    parts.push(padNum(data.price, 6));                       // Precio lista 1 (6 dígitos)
    parts.push(padNum(data.price, 6));                       // Precio lista 2 (6 dígitos)
    parts.push(padNum(data.code ?? data.plu, 5));           // Código PLU (5 dígitos)
    parts.push(padNum(data.sector ?? 1, 2));                  // Sección (2 dígitos)
    parts.push(padNum(data.expiration ?? 0, 4));              // Vencimiento en días (4 dígitos)
    parts.push(data.type ?? "P");                             // Tipo: P/U
    parts.push(padNum(data.tara ?? 0, 6));                    // Tara (6 dígitos)
    parts.push("S");                                          // Flag1 (fijo en "S" según tu trama)
    const ingFlag = data.ingredients ? "S" : "N";             // Ingredientes S/N
    parts.push(ingFlag);                                 // Flag2
    parts.push(padText(data.ingredients || "", 100));         // Ingredientes/otros (100 chars)

    console.log("PLU parts:", "->" + parts.join("|") + "<-");
    return parts.join("");
}

// Clase simple que maneja puerto serie y framing (timeout por inactividad para fin de trama ~6ms)
class Balanza {
    constructor() {
        this.addr = 1; // dirección por defecto
        this.port = null;
        this.buffer = Buffer.alloc(0);
        this.inactivityTimer = null;
        this.inactivityMs = 15; // protocolo ~5ms, usamos 6ms
        this.onFrame = null; // callback cuando llega una trama completa: (Buffer) => {}
        this.streamMode = false; //permite la recepcion continua de datos
    }

    // abre puerto (ej: 'COM3' o '/dev/ttyUSB0'), addr: id de la balanza, baud por default 115200
    async open(portPath, addr=1, baud = 115200) {
        if (this.port && this.port.isOpen) await this.close();
        this.port = new SerialPort({ path: portPath, baudRate: baud, autoOpen: false });
        this.addr = Number(addr);
        return new Promise((resolve, reject) => {
            this.port.open(err => {
                if (err) return reject(err);
                // eventos
                this.port.on('data', this._onData.bind(this));
                this.port.on('error', e => console.error('Serial error', e));
                resolve();
            });
        });
    }

    async close() {
        if (!this.port) return;
        return new Promise((res, rej) => {
            this.port.close(err => {
                if (err) return rej(err);
                this.port = null;
                res();
            });
        });
    }

    _onData(chunk) {
        // 📌 MODO STREAM → se usa para LISTADO DE PLUs (FUNC 31)
        if (this.streamMode) {
            if (this.onFrame) this.onFrame(chunk);
            return;
        }

        // 📌 MODO NORMAL → framing CUORA MAX por timeout
        this.buffer = Buffer.concat([this.buffer, chunk]);
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);

        this.inactivityTimer = setTimeout(() => {
            const frame = this.buffer;
            this.buffer = Buffer.alloc(0);
            if (this.onFrame) this.onFrame(frame);
        }, this.inactivityMs);
    }

    // enviar trama (Buffer)
    writeFrame(buf) {
        if (!this.port || !this.port.isOpen) throw new Error('Puerto no abierto');
        return new Promise((resolve, reject) => {
            this.port.write(buf, err => {
                if (err) return reject(err);
                this.port.drain(err2 => {
                    if (err2) return reject(err2);
                    resolve();
                });
            });
        });
    }

    // wrapper: enviar comando y esperar primera respuesta (o timeout)
    // timeoutMs default 2000
    async sendCommand(func, data = '', timeoutMs = 10_000, retries = 2) {

        const frame = buildFrame(this.addr, func, data);
        await this.writeFrame(frame);

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await new Promise((resolve, reject) => {

                    let cmdBuffer = Buffer.alloc(0);

                    const t = setTimeout(() => {
                        this.onFrame = null;
                        reject(new Error('timeout esperando respuesta'));
                    }, timeoutMs);

                    this.onFrame = (buf) => {
                        // copiamos la trama completa del buffer de recepción
                        cmdBuffer = Buffer.concat([cmdBuffer, buf]);

                        clearTimeout(t);
                        this.onFrame = null;

                        const parsed = parseFrame(cmdBuffer);
                        console.log("parsed", parsed);

                        if (!parsed.ok) return reject(new Error('Respuesta inválida'));
                        if (!parsed.crcValid) {
                            const ascii = parsed.data.toString("ascii");
                            // si parece una trama ASCII válida, aceptarla igual
                            if (/^[\x20-\x7E]*$/.test(ascii)) {
                                resolve(parsed); 
                                return;
                            }
                            return reject(new Error('CRC inválido en respuesta'));
                        }

                        resolve(parsed);
                    };
                });
            } catch (err) {
                if (/CRC inválido/.test(err.message) && attempt < retries) {
                    await new Promise(r => setTimeout(r, 100));
                    continue;
                }
                throw err;
            }
        }
    }
    async sendCommandV2(func, data){
        await this.writeFrame(buildFrame(this.addr, func, data));
		return new Promise((resolve, reject) => {
			let buffer = Buffer.alloc(0);
			const timeout = setTimeout(() => reject(new Error("timeout listado")), 5000);

			this.onFrame = (chunk) => {
				buffer = Buffer.concat([buffer, chunk]);
				if (buffer.includes(0x46)) { // ASCII 'F'
					clearTimeout(timeout);
					this.onFrame = null;
					resolve(buffer.toString("ascii").replaceAll(`\x00`, " "));
				}
			};
		});
    }
    async getWeight() {
        const resp = await this.sendCommand(1, ''); // FUNC=1, sin data
        
        // dataBuf es Buffer con ASCII
        const s = resp.data.toString('ascii');
        // Ejemplo esperado (sin addr/func/crc): "000250e000000" => peso 000250, stable e, tara 000000
        // Formato: peso(6 ó signo+5 caracteres) + stable(1) + tara(6)
        if (s.length < 13) return { ok: false, raw: s };
        // peso:
        let pesoStr = s.substring(0, 6);
        if (pesoStr[0] === '-') {
            pesoStr = '-' + s.substring(1, 6);
        }
        const stable = s.substring(6, 7); // 'e' o 'i'
        const tara = s.substring(7, 13);
        const pesoGr = parseInt(pesoStr, 10);
        const taraGr = parseInt(tara, 10);
        return { ok: true, raw: s, pesoGr, stable, taraGr };
    }
    async setMarquee(text){
		try{
			// texto ASCII max 100 chars
			const resp = await this.sendCommand(6, text.substring(0,100));
		}catch(e){
			//nada
		}
    }
    async listSectors(){
		try{
			const resp = await this.sendCommand(11, '');
			let aux = resp.data.toString('ascii').replaceAll(`\x00`, " ");
			let sectores = [];
			aux.split(";").forEach(element => {
				let num = element.slice(0,2);
				let nom = element.slice(2).trim();
				if(num) sectores.push({ numero: num, nombre: nom });
			});
			return {raw: aux, parsed: sectores};
		}catch(e){
			return {raw: '', parsed: [], error: e.message};
		}
    }
    async deleteSector(number){
        number = number.padStart(2, '0');
        let name = " ".repeat(18).slice(0,18);
        const resp = await this.sendCommand(10, number + name);
    }
    async writeSector(number, name){
        number = number.padStart(2, '0');
        name = name.slice(0,18).padEnd(18, ' ');
        const resp = await this.sendCommand(10, number + name);
    }
    async listProducts(){
        // activamos modo stream
        this.streamMode = true;

        // enviamos comando (Función 31)
        await this.writeFrame(buildFrame(this.addr, 31, ""));

        return new Promise((resolve, reject) => {

            let text = "";
            const timeout = setTimeout(() => {
                this.streamMode = false;
                this.onFrame = null;
                reject(new Error("timeout listado"));
            }, 15000);

            this.onFrame = (chunk) => {
                // recibimos “paquetes crudos” tal cual llegan
                const ascii = chunk.toString("ascii").replace(/\x00/g, "");
                text += ascii;

                // CORRECCIÓN: el protocolo indica que termina solo con 'F'
                if (text.includes("F")) {
                    clearTimeout(timeout);
                    this.streamMode = false;
                    this.onFrame = null;
                    resolve(text);
                }
            };
        });
    }
    async listProductsFull(){
        const resp = await this.listProducts();
        const parsed = resp
        .split("F")[0] //recorto el final de la trama
        .split("N") //divido los productos
        .map(prod => {
            let [plu, version] = prod.split("V");
            return {plu, version};
        })
        .filter(p=> p.plu && p.version);
        //console.log("PLUs:", parsed);
        for(let p of parsed){
            const det = await this.readProduct(p.plu);
            p.details = det.details;
        }
        return parsed;
    }
	async deleteProduct(plu){
		plu = plu.padStart(6, '0');
		const resp = await this.sendCommand(12, plu);
	}
	async writeProduct(data, updatePrice=true, versionSendCommand=1){
		const dataPlu = buildPluExtended(data);
        //console.log("PLU DATA:", dataPlu);
        let resp = null;
        if(versionSendCommand===1){
            resp = await this.sendCommand(4, dataPlu);
        }else if(versionSendCommand===2){
            resp = await this.sendCommandV2(4, dataPlu);
        }
        //console.log("writeProduct: finish");
        let resp2 = null;
        if(updatePrice){
            await new Promise(r => setTimeout(r, 250));
            this.buffer = Buffer.alloc(0);
            resp2 = await this.updatePrice(data.plu, data.price, "2");
            //console.log("updatePrice: finish");
        }
		return resp.data.toString('ascii').replaceAll(`\x00`, " ");
	}
    async writeProducts(productos, updatePrice=true){
        let resps = [];
        let ind = 0;
        for(let prod of productos){
            let r = await this.writeProduct(prod, updatePrice, 1);
            resps.push({index: ind, plu: prod.plu, resp: r});
            ind++;
        }
		return resps;
	}
	async readProduct(plu){
        try{
            plu = plu.toString().padStart(4, "0");
            const resp = await this.sendCommand(3, plu, 2000, 0);
            const s = resp.data.toString('ascii').replaceAll(`\x00`, " ");
            resp.dataParsed = s;
            resp.details = {
                plu: s.slice(0,4).trim(),
                version: s.slice(4,5).trim(),
                name: s.slice(5,23).trim(),
                price1: Number(s.slice(23,29).trim()),
                price2: Number(s.slice(29,35).trim()),
                code: s.slice(35,40).trim(),
                sector: s.slice(40,42).trim(),
                expiration: s.slice(42,46).trim(),
                type: s.slice(46,47).trim(),
                tara: Number(s.slice(47,51).trim()),
                flag1: s.slice(51,52).trim(),
                ingredientsFlag: s.slice(52,53).trim(),
                ingredients: s.slice(53,153).trim(),
            };
            return {raw: resp, details: resp.details};
        }catch(e){
            return {raw: null, details: {}, error: e.message};
        }
	}
    async updatePrice(plu, newPrice, version="2"){
        plu = (plu).toString().padStart(4, '0'); 
        newPrice = (newPrice).toString().padStart(6, '0');
        version = (version).toString().padStart(1, '0');
        const resp = await this.sendCommand(33, plu + version + newPrice + newPrice);
		return resp.data.toString('ascii').replaceAll(`\x00`, " ");
    }
}

// Si ejecutas el archivo directamente
if (require.main === module) {
    demo().catch(err => {
        console.error('Demo falló', err);
    });
}

module.exports = {
  listPorts,
  Balanza,
  buildFrame,
  parseFrame,
  buildPluExtended
};