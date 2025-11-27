class Index{
    constructor(){
        this.ultimoPeso = null;
        this.conectado = false;
        this.puertos = [];
        this.sectores = [];
        this.maxPlu = 0;
        this.tempBlock = false;
        this.init();
    }
    async init(){

        let dominioRasberry = window.location.hostname;
        $("#dominio-raspberry").html(dominioRasberry);

        await this.obtenerPuertos();

        this.configuracion = JSON.parse( localStorage.getItem("configuracion-balanza-cuora-max"), "{}");
        if(this.configuracion){
            $("[name='puerto']").val(this.configuracion.puerto || '');
            $("[name='id']").val(this.configuracion.id || '');
        }

        $("#peso").on("click", async ev=>{
            if(this.tempBlock) return;
            this.tempBlock = true;
            try{
                let resp = await $.get(`/peso/${this.configuracion.id}/`);
                this.ultimoPeso = resp;
                $("#peso").text(resp.pesoGr + ' gr');
            }catch(e){
                console.log(e);
            }finally{
                this.tempBlock = false;
            }
        })

        $("[name='obtener-puertos']").click(async (e)=>{
            try{
                if(this.tempBlock) return;
                this.tempBlock = true;
                await this.obtenerPuertos();
            }catch(err){
                console.log(err);
            }finally{
                this.tempBlock = false;
            }
        });
        $("[name='conectar']").click(async (e)=>{
            if(this.tempBlock) return;
            this.tempBlock = true;
            try{
                let puerto = $("[name='puerto']").val();
                let id = $("[name='id']").val();
                if(!puerto) throw "Seleccione un puerto";
                if(!id) throw "Ingrese un ID de balanza";
    
                let resp = await $.get(`/conectar?puerto=${puerto}&id=${id}`);
                console.log(resp);
                if(resp == 'ok'){
                    this.conectado = true;
                    $("[name='conectar']").prop('disabled', true); 
                    $("[name='desconectar']").prop('disabled', false);
                
                    if(!this.configuracion) this.configuracion = {};
                    this.configuracion.puerto = puerto;
                    this.configuracion.id = id;
                    localStorage.setItem("configuracion-balanza-cuora-max", JSON.stringify(this.configuracion) );
                    modal.message("Conectado a la balanza");
                }
            }catch(err){
                console.log(err);
                modal.message(err.toString());
            }finally{
                this.tempBlock = false;
            }
        });
        $("[name='desconectar']").click(async (e)=>{
            try{
                let resp = await $.get(`/desconectar/${this.configuracion.id}/`);
                console.log(resp);
                if(resp == 'ok'){
                    this.conectado = false;
                    $("[name='conectar']").prop('disabled', false); 
                    $("[name='desconectar']").prop('disabled', true);
                    $("#peso").text('---');
                    modal.message("Desconectado de la balanza");
                }
            }catch(err){
                console.log(err);
                modal.message(err.toString());
            }finally{
            }
        });
        $("[name='enviar-marquesina']").click(async (e)=>{
            if(!this.conectado) return modal.message("No está conectado a la balanza");
            if(this.tempBlock) return;
            this.tempBlock = true;
            try{
                let marquesina = $("[name='marquesina']").val() || '';
                let resp = await $.post({
                    url: `/enviar-marquesina/${this.configuracion.id}/`,
                    data: { marquesina }
                });
                console.log(resp);
                modal.message("Marquesina enviada");
            }catch(err){
                console.log(err);
                modal.message(err.toString());
            }finally{
                this.tempBlock = false;
            }
        });
        $("[name='obtener-sectores']").click(async (e)=>{
            if(!this.conectado) return modal.message("No está conectado a la balanza");
            if(this.tempBlock) return;
            this.tempBlock = true;
            let resp = await $.get(`/sectores/${this.configuracion.id}/`);
            console.log(resp);
            this.sectores = resp;
            this.listarSectores();
            this.tempBlock = false;
        });
        $("[name='obtener-productos']").click(async (e)=>{
            if(!this.conectado) return modal.message("No está conectado a la balanza");
            if(this.tempBlock) return;
            let errMessage = "";
            let productos = [];
            try{
                this.tempBlock = true;
                modal.waiting("Leyendo...");
                let busquedaPluDesde = Number( $("[name='busqueda-plu-desde']").val() || 0 );
                let busquedaPluLimite = Number( $("[name='busqueda-plu-limite']").val() || 100 );
                let resp = await $.get(`/productos/${this.configuracion.id}/?start=${busquedaPluDesde}&limit=${busquedaPluLimite}`);
                
                //verifico q tenga plu (que sea un numero) y nombre 
                productos = resp.map(item=>item.details)
                .filter(p=> p && p.plu && p.name && isNaN(Number(p.plu)) == false );
                console.log(productos);
                if(Array.isArray(resp)) this.listarProductos(productos);
            }catch(err){
                console.log(err);
                errMessage = err.toString();
            }finally{
                this.tempBlock = false;
                modal.hide(false, ()=>{
                    if(errMessage){
                        modal.message("ERROR: " + errMessage);
                    }else{
                        modal.message(`Se encontraron <b>${productos.length}</b> productos.<br>El listado puede llegar incompleto, verifique la cantidad de productos.`);
                    }
                });
            }
        });
        $("[name='agregar-producto']").click((e)=>{
            this.maxPlu++;
            this.agregarLineaProducto();
        });
        $("[name='grabar-listado-productos']").click(async e=>{
            if(!this.conectado) return modal.message("No está conectado a la balanza");
            if(this.tempBlock) return;
            this.tempBlock = true;
            let errMessage = "";
            try{
                modal.waiting("Grabando...");
                await this.grabarListadoProductos();
                modal.message("Proceso ejecutado, intente recargar listado de productos");
            }catch(err){
                console.log(err);
                errMessage = err.toString();
            }finally{
                this.tempBlock = false;
                modal.hide(false, ()=>{
                    if(errMessage){
                        modal.message("ERROR: " + errMessage);
                    }else{
                        modal.message("Proceso finalizado sin errores.");
                    }
                });
            }
        })
        $("[name='leer-producto']").click(async (e)=>{
            if(!this.conectado) return modal.message("No está conectado a la balanza");
            if(this.tempBlock) return;
            this.tempBlock = true;
            try{
                await this.leerProducto();
            }catch(err){
                console.log(err);
                modal.message(err.toString());
            }finally{
                this.tempBlock = false;
            }
        });
        $("[name='descargar-productos-csv']").click((e)=>{
            this.descargarProductosCSV();
        });
        $("[name='cargar-productos-csv']").click((e)=>{
            this.cargarProductosCSV();
        });
        $("[name='imprimir-listado-productos']").click(async (e)=>{
            this.modalImprimir();
        });
    }
    async obtenerPuertos(){
        let resp = await $.get('/puertos');
        console.log(resp);
        if(Array.isArray(resp)){
            this.puertos = resp;
            
            let opt = "<option value=''>Seleccionar puerto</option>";
            this.puertos.forEach(p=>{
                let text = p.path;
                if(p?.friendlyName) text += ` - ${p.friendlyName}`;
                opt += `<option value="${p.path}">${text}</option>`;
            });
            $("[name='puerto']").html(opt);
        }else{
            modal.message("Error al obtener puertos");
        }
    }
    listarSectores(){
        let tbody = "";
        for(let i = 1; i <= 20; i++){
            const num = i.toString().padStart(2,"0");
            const nombre = this.sectores.find(s=>s.numero == num)?.nombre || '';

            tbody += `<tr numero="${num}" index="${i}">
                <td>
                    <input autocomplete="off" type="text" class='form-control form-control-sm' readonly name="numero" value="${num}">
                </td>
                <td>
                    <input autocomplete="off" type="text" class='form-control form-control-sm' name="nombre" value="${nombre}">
                </td>
                <td>
                    <button class="btn btn-success btn-sm" data-index="${i}" name="grabar-sector">Grabar</button>
                    <button class="btn btn-danger btn-sm" data-index="${i}" name="eliminar-sector">Eliminar</button>
                </td>
            </tr>`;
        }
        $("[name='tabla-sectores'] tbody").html(tbody);
        $("[name='tabla-sectores'] [name='eliminar-sector']").click(async (e)=>{
            let ele = $(e.currentTarget);
            let tr = ele.closest("tr");
            let numero = tr.attr("numero");
            
            let resp = await $.ajax({
                method: 'DELETE',
                url: `/eliminar-sector/${this.configuracion.id}/`,
                data: { numero }
            })
            console.log(resp);
            let sx = this.sectores.find(s=>s.numero == numero);
            if(sx) this.sectores = this.sectores.filter(s=>s.numero != numero);
            this.listarSectores();
        });
        $("[name='tabla-sectores'] [name='grabar-sector']").click(async (e)=>{
            let ele = $(e.currentTarget);
            let tr = ele.closest("tr");
            let numero = tr.attr("numero");
            let nombre = tr.find("[name='nombre']").val();

            let resp = await $.ajax({
                method: 'POST',
                url: `/grabar-sector/${this.configuracion.id}/`,
                data: { numero, nombre }
            })
            console.log(resp);
            let sx = this.sectores.find(s=>s.numero == numero);
            if(sx) sx.nombre = nombre;
            else this.sectores.push({ numero, nombre });
            this.listarSectores();
        });
    }
    listarProductos(listado){

        //obtengo el producto con el plu mas alto
        this.maxPlu = listado.reduce((acc, prod, i)=>{
            if(Number(prod?.plu || 0) > acc) acc = Number(prod.plu);
            return acc;
        },0);

        $("[name='tabla-productos'] tbody").html("");
        listado.forEach((prod,i)=>{
            let tr = this.agregarLineaProducto();
            tr.find("[name='plu']").val(prod?.plu || this.maxPlu);
            tr.find("[name='sector']").val(prod?.sector || '');
            tr.find("[name='nombre']").val(prod?.name || '');
            tr.find("[name='precio']").val(Number(prod?.price1 || 0));
        });
    }
    async leerProducto(){
        let v = Number($("[name='leer-plu']").val());
        if(!v || isNaN(v) || v < 0) return modal.message("Ingrese un PLU válido");

        let resp = await $.get(`/leer-producto/${this.configuracion.id}/?plu=${v.toString()}`);
        console.log(resp);
        modal.message(JSON.stringify(resp.details,null,2));
    }
    agregarLineaProducto(){
        let optSectores = "<option value=''>Sin sector</option>";
        this.sectores.forEach(s=>{
            optSectores += `<option value='${s.numero}'>${s.numero} - ${s.nombre}</option>`;
        });

        const tr = `<tr>
                <td><input autocomplete="off" name="plu" type="text" class='form-control form-control-sm' /></td>
                <td>
                    <select name="sector" class='form-control form-control-sm'>${optSectores}</select>
                </td>
                <td><input autocomplete="off" name="nombre" type="text" class='form-control form-control-sm' /></td>
                <td><input autocomplete="off" name="precio" type="text" class='form-control form-control-sm' /></td>
                <td>
                    <button class="btn btn-success btn-sm" name="grabar-producto">Grabar</button>
                    <button class="btn btn-danger btn-sm d-none" name="eliminar-producto">Eliminar</button>
                </td>
            </tr>`;
        $("[name='tabla-productos'] tbody").append(tr);
        const $tr = $("[name='tabla-productos'] tbody tr").last();

        $tr.find("[name='eliminar-producto']")
        //.off("click")
        .on("click", (ev)=>{
            $(ev.currentTarget).closest("tr").remove();
            modal.message("Producto eliminado de la lista, recuerde grabar los cambios");
        });
        $tr.find("[name='grabar-producto']")
        //.off("click")
        .on("click", async (ev)=>{
            let index = $(ev.currentTarget).data('index');
            let tr = $(ev.currentTarget).closest("tr");
            
            let data = {
                plu: tr.find("[name='plu']").val(),
                name: tr.find("[name='nombre']").val(),
                sector: tr.find("[name='sector']").val(),
                price: tr.find("[name='precio']").val() || 1,
            }

            if(this.tempBlock) return;
            this.tempBlock = true;
            try{
                if(!data.plu) return modal.message("Ingrese un PLU");
                if(!data.name) return modal.message("Ingrese un nombre");
                modal.waiting("Grabando producto...");
                let resp = await $.ajax({
                    method: 'POST',
                    url: `/grabar-producto/${this.configuracion.id}/`,
                    data: data
                });
                console.log(resp);
                modal.message("Producto grabado");
            }catch(err){
                console.log(err);
                modal.message(err.toString());
            }finally{
                this.tempBlock = false;
                modal.waiting(false);
            }
        });

        return $tr;
    }
    descargarProductosCSV(separador = ','){
        let csv = "plu,sector,nombre,precio\n";
        $("[name='tabla-productos'] tbody tr").each((i, tr)=>{
            let plu = $(tr).find("[name='plu']").val() || '';
            let sector = $(tr).find("[name='sector']").val() || '';
            let nombre = $(tr).find("[name='nombre']").val() || '';
            let precio = $(tr).find("[name='precio']").val() || '0';
            csv += `"${plu}"${separador}"${sector}"${separador}"${nombre}"${separador}"${Number(precio)}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'productos.csv';
        a.click();
        URL.revokeObjectURL(url);
        modal.message("Archivo CSV descargado");
    }
    cargarProductosCSV(separador = ","){
        $("[name='input-cargar-productos-csv']").click();
        $("[name='input-cargar-productos-csv']")
        .off('change')
        .on('change', (e)=>{
            let file = e.target.files[0];
            if(!file) return;
            let reader = new FileReader();
            reader.onload = (event) => {
                let text = event.target.result;
                $("[name='tabla-productos'] tbody").html("");
                text.split('\n').forEach((linea, index)=>{
                    if(index == 0) return; //salto la primera linea (headers)
                    if(!linea.trim()) return;
                    let partes = linea.split(separador);
                    let plu = (partes[0] || '').replace(/"/g,'').trim();
                    let sector = (partes[1] || '').replace(/"/g,'').trim();
                    let nombre = (partes[2] || '').replace(/"/g,'').trim();
                    let precio = (partes[3] || '0').replace(/"/g,'').trim();
                    
                    let tr = this.agregarLineaProducto();
                    tr.find("[name='plu']").val(plu);
                    tr.find("[name='sector']").val(sector);
                    tr.find("[name='nombre']").val(nombre);
                    tr.find("[name='precio']").val(Number(precio || 0));
                });
            };
            reader.readAsText(file);
        });
    }
    async grabarListadoProductos(){
        let productos = [];

        $("[name='tabla-productos'] tbody tr").each((ind, row)=>{
            let $tr = $(row);
            let plu = $tr.find("[name='plu']").val();
            let nombre = $tr.find("[name='nombre']").val();
            let sector = $tr.find("[name='sector']").val();
            let precio = $tr.find("[name='precio']").val();
            productos.push({
                plu: plu, 
                name: nombre, 
                sector: sector, 
                price: precio,
            });
        });

        if(productos.length == 0) throw new Error("No hay productos para grabar");

        let resp = await $.ajax({
            method: 'POST',
            url: `/grabar-listado-productos/${this.configuracion.id}/`,
            data: { productos: JSON.stringify(productos) }
        });
        console.log(resp);
        return resp;
    }
    modalImprimir(){
        modal.show({
            title: "Imprimir",
            body: $("#modal-imprimir").html(),
            buttons:"back"
        })

        $("#modal [name='imprimir']").on("click", async (e)=>{
            let tamano = $("#modal [name='tamano']").val() || 16;
            let columnas = $("#modal [name='columnas']").val() || 3; // no implementado por ahora
            let orden = $("#modal [name='orden']").val() || 'plu';
            let precio = $("#modal [name='precio']").val() || 'no';


            let productos = [];
            $("[name='tabla-productos'] tbody tr").each((ind, row)=>{
                let $tr = $(row);
                let plu = $tr.find("[name='plu']").val();
                let nombre = $tr.find("[name='nombre']").val();
                let sector = $tr.find("[name='sector']").val();
                let precio = $tr.find("[name='precio']").val();
                productos.push({
                    plu: plu, 
                    name: nombre,
                    sector: sector,
                    price: precio,
                });
            });

            if(orden == 'sector'){
                productos.sort((a,b)=>{
                    if(a.sector < b.sector) return -1;
                    if(a.sector > b.sector) return 1;
                    else{
                        if(a.name < b.name) return -1;
                        if(a.name > b.name) return 1;
                    }
                    return 0;
                });
            }else if(orden == 'plu'){
                productos.sort((a,b)=>{
                    return Number(a.plu) - Number(b.plu);
                });
            }else if(orden == 'nombre'){
                productos.sort((a,b)=>{
                    if(a.name < b.name) return -1;
                    if(a.name > b.name) return 1;
                    return 0;
                });
            }

            let bgWhite = true;
            let body = productos.reduce((acc, prod)=>{
                if(!parseInt(prod.plu)) return acc; //salto productos sin plu valido
                bgWhite = !bgWhite;
                let line = 
                `<div class='row my-1 p-2 ${bgWhite ? 'bg-white' : 'bg-light'}'>
                    <div class='col-2 font-weight-bold'>
                        ${parseInt(prod.plu)}
                    </div>
                    <div class='col-8'>
                        ${prod.name}
                    </div>
                    <div class='col-2 text-right font-weight-bold'>
                        ${precio == 'si' ? `$ ${parseInt(prod.price)}` : ''}
                    </div>
                </div>`;
                acc.push(line);
                return acc;
            }, []);

            let html = `
                <html>
                <head>
                    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css" >
                    <style>
                        /* Ocultar un elemento con una clase específica al imprimir */
                        .no-imprimir {
                            display: none;
                        }

                        /* Ocultar elementos con una clase específica en la pantalla */
                        @media screen {
                            .no-imprimir {
                                display: block; /* Asegura que el elemento se muestra en pantalla */
                            }
                        }
                    </style>
                </head>
                <body style='font-size:${tamano}px;'>
                    <div class='text-center'>
                        <button class='btn btn-primary no-imprimir m-auto' onclick="window.print(); window.close();">Imprimir</button>
                    </div>
                    <div class='container'>
                        <h1 class='text-center'>Códigos System Cuora</h1>
                        ${body.join('')}
                    </div>
                </body>
                </html>
            `;

            const win = window.open("", "_blank", "width=600,height=800");
            win.document.open();
            win.document.write(html);
            modal.hide();
            /* if(window.electronAPI?.isElectron){
                const win = window.open("", "_blank", "width=600,height=800");
                win.document.open();
                win.document.write(html);
                //win.document.close();
            }else{
                let w = window.open("/imprimir", "_blank");
            } */
            /* let resp = await $.post({
                url: `/imprimir`,
                data: { content: html }
            });
            console.log(resp);
            modal.message("Listado enviado a la impresora"); */
        });
    }
}