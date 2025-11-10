const http = require("http");
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const cuoraMax = require('./cuoraMax');
var balanzas = [];


require('dotenv').config();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

//funciones globales
app.get("/ping", (req, res)=>{
    res.send("pong");
    res.end();
});
app.get("/", (req, res)=>{
    res.sendFile(__dirname + "/index.html");
});
app.get("/script.js", (req, res)=>{
    res.sendFile(__dirname + "/script.js");
});

//funciones balanza
app.get("/puertos", async (req, res)=>{
    const puertos = await cuoraMax.listPorts();
    res.json(puertos);
    res.end();
});
app.get("/conectar", async (req, res)=>{
    try{
        const puerto = req.query.puerto;
        const addr = req.query.id;
    
        if(balanzas.find(b => b.puerto === puerto)) throw new Error("Ya hay una balanza conectada en ese puerto");
        const balanza = new cuoraMax.Balanza();
        balanza.open(puerto, addr);
        balanzas.push({puerto, balanza});
        res.send("ok");
        res.end();
    }catch(err){ 
        res.status(500).end("error: " + err.message);
    }
});
app.get("/desconectar", async (req, res)=>{
    try{
        const puerto = req.query.puerto;
        let balanza = balanzas.find(b => b.puerto === puerto);
        if(!balanza) throw new Error("No hay ninguna balanza conectada en ese puerto");
        balanza.close();
        balanzas = balanzas.filter(b => b.puerto !== puerto);
        res.send("ok");
        res.end();
    }catch(err){
        res.status(500).end("error: " + err.message);
    }
});
app.get("/peso", async (req, res)=>{
    try{
        const puerto = req.query.puerto;
        let balanza = balanzas.find(b => b.puerto === puerto);
        if(!balanza) throw new Error("No hay ninguna balanza conectada en ese puerto");
        const resp = await balanza.balanza.getWeight();
        res.json(resp);
        res.end();
    }catch(err){
        res.status(500).end("error: " + err.message);
    }
});
app.post("/enviar-marquesina", async (req, res)=>{
    try{
        const puerto = req.query.puerto;
        let balanza = balanzas.find(b => b.puerto === puerto);
        if(!balanza) throw new Error("No hay ninguna balanza conectada en ese puerto");
        balanza.setMarquee(req.body.marquesina || '');
        res.end("ok");
    }catch(err){
        console.log(err);
        res.status(500).end("error: " + err.message);
    }
});

// Sectores son grupos/categorias. Ej: Carniceria, Verduleria, etc
app.get("/sectores", async (req, res)=>{
    try{
        const puerto = req.query.puerto;
        let balanza = balanzas.find(b => b.puerto === puerto);
        if(!balanza) throw new Error("No hay ninguna balanza conectada en ese puerto");
        const sectores = await balanza.listSectors();
        res.json(sectores.parsed);
    }catch(err){
        console.log(err);
        res.status(500).end("error: " + err.message);
    }
});
app.delete("/eliminar-sector", async (req, res)=>{
    try{
        const puerto = req.query.puerto;
        let balanza = balanzas.find(b => b.puerto === puerto);
        if(!balanza) throw new Error("No hay ninguna balanza conectada en ese puerto");
        await balanza.deleteSector(req.body.numero || '0');
        res.end("ok");
    }catch(err){
        console.log(err);
        res.status(500).end("error: " + err.message);
    }
});
app.post("/grabar-sector", async (req, res)=>{
    try{
        console.log(req.body);
        const puerto = req.query.puerto;
        let balanza = balanzas.find(b => b.puerto === puerto);
        if(!balanza) throw new Error("No hay ninguna balanza conectada en ese puerto");
        const resp = await balanza.writeSector(req.body.numero || '0', req.body.nombre || '');
        console.log(resp);
        res.end("ok");
    }catch(err){
        console.log(err);
        res.status(500).end("error: " + err.message);
    }
});

app.get("/productos", async (req, res)=>{
    try{
        const puerto = req.query.puerto;
        let balanza = balanzas.find(b => b.puerto === puerto);
        if(!balanza) throw new Error("No hay ninguna balanza conectada en ese puerto");
        const productos = await balanza.listProductsFull();
        console.log(productos);
        res.json(productos);
    }catch(err){
        console.log(err);
        res.status(500).end("error: " + err.message);
    }
});
app.delete("/eliminar-producto", async (req, res)=>{
    try{
        const puerto = req.query.puerto;
        let balanza = balanzas.find(b => b.puerto === puerto);
        if(!balanza) throw new Error("No hay ninguna balanza conectada en ese puerto");
        await balanza.deleteProduct(req.body.plu || '0');
        res.end("ok");
    }catch(err){
        console.log(err);
        res.status(500).end("error: " + err.message);
    }
});
app.post("/grabar-producto", async (req, res)=>{
    try{
        console.log(req.body);
        const puerto = req.query.puerto;
        let balanza = balanzas.find(b => b.puerto === puerto);
        if(!balanza) throw new Error("No hay ninguna balanza conectada en ese puerto");
        await balanza.writeProduct(req.body);
        res.end("ok");
    }catch(err){
        console.log(err);
        res.status(500).end("error: " + err.message);
    }
});
app.get("/leer-producto", async (req, res)=>{
    try{
        const puerto = req.query.puerto;
        let balanza = balanzas.find(b => b.puerto === puerto);
        if(!balanza) throw new Error("No hay ninguna balanza conectada en ese puerto");
        const resp = await balanza.readProduct(req.query.plu || '0');
        res.json(resp);
    }catch(err){
        console.log(err);
        res.status(500).end("error: " + err.message);
    }
});
app.listen(process.env.PORT || 3000, () => {
    console.log("Server started on port " + (process.env.PORT || 3000));
});

