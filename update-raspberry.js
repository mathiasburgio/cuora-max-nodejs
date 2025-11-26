const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const axios = require("axios");
const FormData = require("form-data");


//NOTA-> Cambiá esta URL por la de tu Raspberry
const RASPBERRY_URL = "http://192.168.0.31:3333";

// Archivos que querés enviar
const FILES_TO_SEND = [
    path.join(__dirname, "index.js"),
    path.join(__dirname, "cuoraMax.js"),
    path.join(__dirname, "script.js"),
    path.join(__dirname, "index.html"),
    path.join(__dirname, "Modal2.js"),
];
const ZIP_PATH = path.join(__dirname, "update.zip");

async function updateInRaspberry() {
    try{
        // ---- 1. Crear ZIP con adm-zip ----
        console.log("Generando ZIP...");
        const zip = new AdmZip();

        for (const file of FILES_TO_SEND) {
            zip.addLocalFile(file);
        }
        zip.writeZip(ZIP_PATH);

        // ---- 2. Enviar ZIP por multipart/form-data ----
        console.log("Subiendo ZIP al Raspberry...");
        
        const form = new FormData();
        form.append("file", fs.createReadStream(ZIP_PATH));

        let res = await axios.post(`${RASPBERRY_URL}/update-software`, form, {
            headers: form.getHeaders()
        });

        console.log("Respuesta update:", res.data);

        // ---- 3. Esperar unos segundos ----
        await new Promise(r => setTimeout(r, 3000));

        // ---- 4. Llamar al restart ----
        console.log("Reiniciando software en Raspberry...");

        res = await axios.post(`${RASPBERRY_URL}/restart-software`);
        console.log("Respuesta restart:", res.data);

        console.log("✔ Proceso terminado correctamente.");
    }catch(err){
        console.error("Error al actualizar en Raspberry:", err.message);
    }
}

updateInRaspberry();