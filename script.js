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

        await this.obtenerPuertos();

        this.configuracion = JSON.parse( localStorage.getItem("configuracion-balanza-cuora-max"), "{}");
        if(this.configuracion){
            $("[name='puerto']").val(this.configuracion.puerto || '');
            $("[name='id']").val(this.configuracion.id || '');
            if(this.configuracion.solicitarPesoContinuo === false) $("#peso").addClass("text-danger");
        }

        setInterval(async ()=>{
            if(this.conectado == false) return;
            if(this?.configuracion?.solicitarPesoContinuo === false) return;
            if(this.tempBlock) return;

            $("#peso").toggleClass("bg-info bg-warning");
            try{
                let resp = await $.get(`/peso/${this.configuracion.id}/`);
                this.ultimoPeso = resp;
                $("#peso").text(resp.pesoGr + ' gr');
            }catch(e){
                console.log(e);
            }
        },3000);

        $("#peso").on("click", ev=>{
            $(ev.currentTarget).toggleClass("text-danger");
            this.configuracion.solicitarPesoContinuo = !this.configuracion.solicitarPesoContinuo;
            localStorage.setItem("configuracion-balanza-cuora-max", JSON.stringify(this.configuracion) );
        })

        $("[name='obtener-puertos']").click(async (e)=>{
            await this.obtenerPuertos();
        });
        $("[name='conectar']").click(async (e)=>{
            let puerto = $("[name='puerto']").val();
            let id = $("[name='id']").val();
            if(!puerto) return alert("Seleccione un puerto");
            if(!id) return alert("Ingrese un ID de balanza");

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
            }
        });
        $("[name='desconectar']").click(async (e)=>{
            let resp = await $.get(`/desconectar/${this.configuracion.id}/`);
            console.log(resp);
            if(resp == 'ok'){
                this.conectado = false;
                $("[name='conectar']").prop('disabled', false); 
                $("[name='desconectar']").prop('disabled', true);
                $("#peso").text('---');
            }
        });
        $("[name='enviar-marquesina']").click(async (e)=>{
            if(!this.conectado) return alert("No está conectado a la balanza");
            this.tempBlock = true;
            let marquesina = $("[name='marquesina']").val() || '';
            let resp = await $.post({
                url: `/enviar-marquesina/${this.configuracion.id}/`,
                data: { marquesina }
            });
            console.log(resp);
            this.tempBlock = false;
        });
        $("[name='obtener-sectores']").click(async (e)=>{
            if(!this.conectado) return alert("No está conectado a la balanza");
            this.tempBlock = true;
            let resp = await $.get(`/sectores/${this.configuracion.id}/`);
            console.log(resp);
            this.sectores = resp;
            this.listarSectores();
            this.tempBlock = false;
        });
        $("[name='obtener-productos']").click(async (e)=>{
            if(!this.conectado) return alert("No está conectado a la balanza");
            this.tempBlock = true;
            let resp = await $.get(`/productos/${this.configuracion.id}/`);
            console.log(resp);
            if(Array.isArray(resp)) this.listarProductos(resp);
            this.tempBlock = false;
        });
        $("[name='agregar-producto']").click((e)=>{
            this.maxPlu++;
            this.agregarLineaProducto();
        });
        $("[name='grabar-productos']").click(async e=>{
            this.tempBlock = true;
            await this.grabarProductos();
            this.tempBlock = false;
            alert("Proceso ejecutado, ver consola para más detalles");
        })
        $("[name='leer-producto']").click(async (e)=>{
            if(!this.conectado) return alert("No está conectado a la balanza");
            this.tempBlock = true;
            this.leerProducto();
            this.tempBlock = false;
        });
        $("[name='descargar-productos-csv']").click((e)=>{
            this.descargarProductosCSV();
        });
        $("[name='cargar-productos-csv']").click((e)=>{
            this.cargarProductosCSV();
        });
    }
    async obtenerPuertos(){
        let resp = await $.get('/puertos');
        console.log(resp);
        if(Array.isArray(resp)){
            this.puertos = resp;
            
            let opt = "<option value=''>Seleccionar puerto</option>";
            this.puertos.forEach(p=>{
                opt += `<option value="${p.path}">${p.path} - ${p?.friendlyName}</option>`;
            });
            $("[name='puerto']").html(opt);
        }else{
            alert("Error al obtener puertos");
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
            tr.find("[name='sector']").val(prod?.details?.sector || '');
            tr.find("[name='nombre']").val(prod?.details?.name || '');
            tr.find("[name='precio']").val(Number(prod?.details?.price1 || 0));
        });
    }
    async leerProducto(){
        let v = Number($("[name='leer-plu']").val());
        if(!v || isNaN(v) || v < 0) return alert("Ingrese un PLU válido");

        let resp = await $.get(`/leer-producto/${this.configuracion.id}/?plu=${v.toString()}`);
        console.log(resp);
        alert(JSON.stringify(resp.details,null,2));
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
                    <button class="btn btn-danger btn-sm" name="eliminar-producto">Eliminar</button>
                </td>
            </tr>`;
        $("[name='tabla-productos'] tbody").append(tr);

        $("[name='tabla-productos'] [name='eliminar-producto']")
        .off("click")
        .on((e)=>{
            let index = $(e.currentTarget).data('index');
            let tr = $(e.currentTarget).closest("tr");
            tr.remove();
        });

        return $("[name='tabla-productos'] tbody").last();
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
    async grabarProductos(){
        let resultado = [];

        let rows =  $("[name='tabla-productos'] tbody tr");
        let ind = 0;
        for(let row of rows){
            try{
                let $tr = $(row);
                let plu = $tr.find("[name='plu']").val();
                let nombre = $tr.find("[name='nombre']").val();
                let sector = $tr.find("[name='sector']").val();
                let precio = $tr.find("[name='precio']").val();

                let resp = await $.ajax({
                    method: 'POST',
                    url: `/grabar-producto/${this.configuracion.id}/`,
                    data: { 
                        plu: plu, 
                        name: nombre, 
                        sector: sector, 
                        price: precio,
                        //code: plu,
                        //expiration: 0,
                        //type: 'P', // P (pesable) U (unitario) E (escurrido) C (congelado)
                        //tara: 0
                    }
                });
                resultado.push({
                    ind: ind,
                    row: row,
                    plu: plu,
                    response: resp
                })
            }catch(err){
                resultado.push({
                    ind: ind,
                    row: row,
                    error: true,
                    response: err
                });
            }
            ind++;
        }
        console.log(resultado);
        return true;
    }
}