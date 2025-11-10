class Index{
    constructor(){
        this.ultimoPeso = null;
        this.conectado = false;
        this.puertos = [];
        this.sectores = [];
        this.productos = [];
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
                let resp = await $.get('/peso?puerto='+this?.configuracion?.puerto);
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

            let resp = await $.get('/conectar?puerto=' + puerto + '&id=' + id);
            console.log(resp);
            if(resp == 'ok'){
                this.conectado = true;
                $("[name='conectar']").prop('disabled', true); 
                $("[name='desconectar']").prop('disabled', false);
            
            
                this.configuracion.puerto = puerto;
                this.configuracion.id = id;
                localStorage.setItem("configuracion-balanza-cuora-max", JSON.stringify(this.configuracion) );
            }
        });
        $("[name='desconectar']").click(async (e)=>{
            let resp = await $.get('/desconectar?puerto='+this?.configuracion?.puerto);
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
                url: '/enviar-marquesina?puerto='+this?.configuracion?.puerto,
                data: { marquesina }
            });
            console.log(resp);
            this.tempBlock = false;
        });
        $("[name='obtener-sectores']").click(async (e)=>{
            if(!this.conectado) return alert("No está conectado a la balanza");
            this.tempBlock = true;
            let resp = await $.get('/sectores?puerto='+this?.configuracion?.puerto);
            console.log(resp);
            this.sectores = resp;
            this.listarSectores();
            this.tempBlock = false;
        });
        $("[name='obtener-productos']").click(async (e)=>{
            if(!this.conectado) return alert("No está conectado a la balanza");
            this.tempBlock = true;
            let resp = await $.get('/productos?puerto='+this?.configuracion?.puerto);
            console.log(resp);
            if(Array.isArray(resp)) this.productos = resp;
            this.listarProductos();
            this.tempBlock = false;
        });
        $("[name='agregar-producto']").click((e)=>{
            this.maxPlu++;
            this.productos.push({ plu: '', nombre: '', sector: '', precio: ''});
            this.listarProductos();
        });
        $("[name='leer-producto']").click(async (e)=>{
            if(!this.conectado) return alert("No está conectado a la balanza");
            this.tempBlock = true;
            this.leerProducto();
            this.tempBlock = false;
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
                url: '/eliminar-sector?puerto='+this?.configuracion?.puerto,
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
                url: '/grabar-sector?puerto='+this?.configuracion?.puerto,
                data: { numero, nombre }
            })
            console.log(resp);
            let sx = this.sectores.find(s=>s.numero == numero);
            if(sx) sx.nombre = nombre;
            else this.sectores.push({ numero, nombre });
            this.listarSectores();
        });
    }
    listarProductos(){


        let optSectores = "<option value=''>Sin sector</option>";
        this.sectores.forEach(s=>{
            optSectores += `<option value='${s.numero}'>${s.numero} - ${s.nombre}</option>`;
        });

        //obtengo el producto con el plu mas alto
        this.maxPlu = this.productos.reduce((acc, prod, i)=>{
            if(Number(prod?.plu || 0) > acc) acc = Number(prod.plu);
            return acc;
        },0);

        $("[name='tabla-productos'] tbody").html("");
        this.productos.forEach((prod,i)=>{
            const tr = `<tr>
                <td><input autocomplete="off" name="plu" type="text" class='form-control form-control-sm' value="${prod?.plu || this.maxPlu}" /></td>
                <td>
                    <select name="sector" class='form-control form-control-sm'>${optSectores}</select>
                </td>
                <td><input autocomplete="off" name="nombre" type="text" class='form-control form-control-sm' value="${prod?.details?.name || ''}" /></td>
                <td><input autocomplete="off" name="precio" type="text" class='form-control form-control-sm' value="${Number(prod?.details?.price1 || 0)}" /></td>
                <td>
                    <button class="btn btn-success btn-sm" name="grabar-producto">Grabar</button>
                    <button class="btn btn-danger btn-sm" name="eliminar-producto">Eliminar</button>
                </td>
            </tr>`;
            $("[name='tabla-productos'] tbody").append(tr);
            $("[name='tabla-productos'] tbody tr").last().find("[name='sector']").val(prod?.details?.sector || '');
        });
        $("[name='tabla-productos'] [name='eliminar-producto']").click((e)=>{
            let index = $(e.currentTarget).data('index');
            this.productos.splice(index,1);
            this.listarProductos();
        });
        $("[name='tabla-productos'] [name='grabar-producto']").click(async (e)=>{
            let ele = $(e.currentTarget);
            let tr = ele.closest("tr");
            let plu = tr.find("[name='plu']").val();
            let nombre = tr.find("[name='nombre']").val();
            let sector = tr.find("[name='sector']").val();
            let precio = tr.find("[name='precio']").val();
            if(!plu) return alert("Ingrese un PLU");
            if(!nombre) return alert("Ingrese un nombre");
            if(!precio) return alert("Ingrese un precio");
            let resp = await $.ajax({
                method: 'POST',
                url: '/grabar-producto',
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
            console.log(resp);
        });
    }
    async leerProducto(){
        let v = Number($("[name='leer-plu']").val());
        if(!v || isNaN(v) || v < 0) return alert("Ingrese un PLU válido");

        let resp = await $.get('/leer-producto?plu=' + v.toString() + "&puerto=" + this?.configuracion?.puerto);
        console.log(resp);
        alert(JSON.stringify(resp.details,null,2));
    }
}