# cuora-max-nodejs

`cuora-max-nodejs` es un software diseñado para ser ejecutado principalmente en **Raspberry Pi**, preferentemente utilizando **Raspberry Pi OS Bookworm de 32 bits (ARM)** para asegurar total compatibilidad con nuestro sistema complementario *portal-rpi*. No obstante, también funciona correctamente en **Windows**.

Su objetivo es interactuar con balanzas **Systel Cuora** y **Cuora Max**, permitiendo **leer, editar y escribir el listado de productos**, además de gestionar sectores y otras funciones soportadas por los dispositivos.

---

## 🚀 Instalación y puesta en marcha

1. **Copiar los archivos del proyecto** en el dispositivo donde se ejecutará (Raspberry Pi o Windows).
2. Clonar el archivo `.env-example` como `.env`:

   ```sh
   cp .env-example .env
   ```
3. Editar las variables de entorno según sea necesario.

### Variables importantes

* **`LIMIT_BALANZAS`**: define cuántas balanzas pueden estar conectadas simultáneamente. Esto permite limitar instancias activas para evitar saturación o conflictos.

---

## 🔗 Sistemas complementarios

### **portal-rpi4**

Sistema para Raspberry Pi que permite:

* Gestionar un **portal cautivo**.
* Asignar red al dispositivo mediante conexión directa (modo Access Point).
* Emitir un **"echo" identificador** para que otros programas puedan detectarlo automáticamente.

### **cuora-max-electron-windows**

Aplicación de escritorio en Windows que:

* Escucha el "echo" emitido por *portal-rpi4*.
* Se conecta automáticamente y de forma transparente a `cuora-max-nodejs`.

---

# 📡 Documentación de la API

A continuación se describe cada endpoint del sistema junto con aclaraciones importantes.

> **Aclaraciones generales**:
>
> 1. `GET /puertos` retorna **puertos COM y USB** disponibles para conectar balanzas.
> 2. Leer productos desde la balanza **suele fallar**: es preferible trabajar con un **listado local en PC** y escribir siempre el listado completo en la memoria de la balanza.
> 3. En frontend, antes de mostrar productos con sus sectores, **primero se deben obtener los sectores**.

---

## 📁 **/puertos**

**GET** `/puertos`

Obtiene la lista de puertos COM y USB disponibles.

---

## 🔌 **/conectar**

**GET** `/conectar?puerto=COMX&id=1`

Conecta una balanza en el puerto indicado. `20` es el id por defecto.

Restricciones:

* Si ya está conectada, retorna `ok`.
* Si supera `LIMIT_BALANZAS`, devuelve error.

---

## 🔌 **/desconectar/:iddr**

**GET** `/desconectar/1`

Cierra la comunicación con la balanza del ID especificado.

---

## ⚖️ **/peso/:iddr**

**GET** `/peso/1`

Devuelve el peso actual leído desde la balanza.

---

## 💬 **/enviar-marquesina/:iddr**

**POST** `/enviar-marquesina/1`

Envía una marquesina (mensaje de texto) a la balanza.

```json
{
  "marquesina": "OFERTAS HOY"
}
```

---

## 🗂️ **Sectores**

Los sectores son categorías como *Carnicería*, *Verdulería*, *Fiambrería*, etc.

### **/sectores/:iddr**

**GET** `/sectores/1`

Devuelve el listado de sectores.

> ⚠️ En frontend, obligatorio obtener sectores antes de cargar productos.

---

### **/eliminar-sector/:iddr**

**DELETE** `/eliminar-sector/1`

Body:

```json
{
  "numero": "4"
}
```

---

### **/grabar-sector/:iddr**

**POST** `/grabar-sector/1`

```json
{
  "numero": "4",
  "nombre": "Fiambrería"
}
```

---

# 🛒 Productos

> ⚠️ **IMPORTANTE**: Obtener productos desde la balanza es propenso a fallos.
> Se recomienda:
>
> * Trabajar siempre con un **listado desde PC**.
> * Escribir el listado completo en la memoria de la balanza.

---

### **/productos/:iddr**

**GET** `/productos/1?start=0&limit=100`

Lee productos en un rango.

---

### **/eliminar-producto/:iddr**

**DELETE** `/eliminar-producto/1`

```json
{
  "plu": "0001"
}
```

---

### **/grabar-producto/:iddr**

**POST** `/grabar-producto/1`

Graba un solo producto.

Body ejemplo:

```json
{
  "plu": "0001",
  "sector": "1",
  "nombre": "Carne picada",
  "precio": 3999
}
```

---

### **/grabar-listado-productos/:iddr**

**POST** `/grabar-listado-productos/1`

Graba un listado completo de productos.

```json
{
  "productos": "[...]"
}
```

Recomendado para evitar fallos típicos de lectura individual desde la balanza.

---

### **/leer-producto/:iddr**

**GET** `/leer-producto/1?plu=0001`

Lee un producto específico.

---

# ✒️ Autor

Creado por **Mathias Burgio** — Roque Pérez, Buenos Aires
