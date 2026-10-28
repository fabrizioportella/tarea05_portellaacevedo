# Anexo fotográfico de fiscalización

Aplicación frontend responsive para registrar una fiscalización, incorporar fotografías y generar un anexo Word (`.docx`) con las imágenes enmarcadas y sus descripciones.

## Requisitos

- Navegador moderno compatible con IndexedDB y `FileReader`.
- Para generar el documento no se necesitan instalaciones ni servicios externos.
- Para ejecutar localmente se recomienda Python 3.

### Dependencias utilizadas

- HTML, CSS y JavaScript puro.
- IndexedDB: persistencia local de proyectos, descripciones y archivos de imagen.
- [`docx`](https://github.com/dolanmiu/docx): biblioteca JavaScript usada para construir el archivo Word real. Está incluida localmente en `vendor/docx.iife.js`.
- No utiliza rutas de archivos temporales ni requiere una base de datos SQL para guardar las imágenes.

## Ejecución en computadora

Desde la carpeta del proyecto:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Luego abra:

```text
http://localhost:4173
```

También puede abrir `index.html` directamente, aunque se recomienda usar el servidor HTTP para asegurar el funcionamiento de la cámara y evitar restricciones de seguridad del navegador.

## Uso desde un celular

El servidor y el celular deben estar conectados a la misma red Wi-Fi.

1. En la Mac, obtenga la dirección IP activa:

   ```bash
   ipconfig getifaddr en0
   ```

2. Inicie el servidor permitiendo conexiones externas:

   ```bash
   cd /Users/smkrlg/Documents/trabajos_senati/trabajoshtml/tarea05
   python3 -m http.server 4173 --bind 0.0.0.0
   ```

3. Desde el celular, abra en el navegador:

   ```text
   http://IP-DE-LA-MAC:4173
   ```

   Por ejemplo:

   ```text
   http://192.168.1.20:4173
   ```

4. Mantenga el servidor abierto mientras use la aplicación.

### Habilitar la captura de fotografías

- Pulse **“Tomar fotografía”** y conceda permiso de cámara cuando el navegador lo solicite.
- En iPhone, la cámara devuelve la foto a una vista previa; la foto no se guarda inmediatamente. Revise la imagen y pulse **Confirmar e incorporar** para almacenarla en IndexedDB.
- Si confirma con una imagen HEIC/HEIF, la aplicación la convierte a JPEG antes de guardarla y exportarla. Para una mayor compatibilidad con modelos antiguos de iPhone, configure la cámara para capturar «Más compatibles» (JPEG) en Ajustes > Cámara > Formatos.
- Chrome, Edge y otros navegadores suelen pedir primero permiso al usar la cámara.
- Si usa Safari, habilite permisos desde **Configuración > Safari > Cámara** y confirme el permiso en la barra o panel del sitio.
- Use **“Seleccionar imágenes”** como alternativa para elegir fotos existentes.
- Si aparece una vista previa, revise la imagen y confirme antes de incorporarla.
- Android y iPhone generalmente muestran el botón de cámara como entrada nativa al usar `capture="environment"`.

### Uso en producción o fuera de la red local

La cámara móvil puede estar restringida a `localhost` o a conexiones HTTPS. Para pruebas públicas se recomienda publicar los archivos en GitHub Pages, Netlify u otro alojamiento HTTPS. La aplicación no requiere backend ni variables de entorno.

## Flujo de trabajo

1. Cree o abra un proyecto.
2. Complete código, fecha, lugar, fiscalizador y unidad/establecimiento ficticio.
3. Pulse **Guardar proyecto**.
4. Capture o seleccione una o varias imágenes y revise la vista previa.
5. Confirme la incorporación.
6. Corrija descripciones, cambie el orden o elimine una fotografía si es necesario.
7. Pulse **↓ Imagen** dentro de una fotografía para descargar ese archivo individualmente.
8. Pulse **Descargar anexo Word (.docx)** para descargar el anexo completo.

## Contenido del Word generado

- Encabezado con el código de práctica y datos generales.
- Una tabla por fotografía.
- Fotografía dentro de un cuadro de ancho completo.
- Segunda fila con el número visible de fotografía a la izquierda y su descripción a la derecha.
- Numeración según el orden decidido en la aplicación.
- Imágenes incrustadas, no enlaces externos.

## Persistencia

Los proyectos se guardan en IndexedDB del navegador específico utilizado:

- Las imágenes se almacenan como datos binarios dentro de la base local.
- Un proyecto no mezcla las fotos de otros proyectos.
- Los datos permanecen después de cerrar o recargar la aplicación en el mismo navegador y perfil.
- IndexedDB no sincroniza automáticamente entre computadora y celular.
- Si se borran los datos del navegador, se usa navegación privada o se cambia de perfil/origen, el contenido puede desaparecer.

## Limitaciones conocidas

- El servidor HTTP local no proporciona HTTPS. Por ello, el acceso desde el celular puede permitir selección de imágenes, pero la autorización de cámara puede variar según el navegador.
- El permiso de cámara debe concederse nuevamente si se borra la configuración del sitio o se cambia de navegador/dispositivo.
- Una dirección `http://IP-DE-LA-MAC` puede bloquearse por el firewall de macOS o por políticas de la red Wi-Fi.
- Algunas redes corporativas o públicas aislan dispositivos y impiden que el celular alcance la Mac.
- El almacenamiento está limitado por el navegador y el dispositivo; archivos muy grandes o proyectos con muchas imágenes pueden agotar la cuota disponible.
- Los navegadores móviles pueden comprimir o cambiar metadatos de las imágenes según su configuración.
- La aplicación no certifica la fecha original de una fotografía; únicamente registra la fecha y hora en que fue incorporada.
- Esta aplicación es local: no tiene autenticación, respaldo remoto, colaboración ni sincronización entre dispositivos.
- Cambiar el puerto o el nombre de equipo puede cambiar el origen del sitio y, por consecuencia, los datos visibles en IndexedDB.

## Prueba recomendada

Utilice fotografías propias de objetos o espacios autorizados y datos completamente ficticios. No incluya imágenes, identificadores o descripciones reales de expedientes o materiales sensibles.

## Pruebas obligatorias de demostración

Para demostrar el recorrido completo, realice las siguientes pruebas y registre el resultado con una breve captura de pantalla o video:

1. **Captura móvil:** desde un teléfono, pulse **Tomar fotografía**, autorice la cámara, confirme una imagen y compruebe que aparece en la galería con su descripción.
2. **Recuperación:** cierre por completo la aplicación y vuelva a abrirla en el mismo navegador y perfil. Compruebe que el proyecto, la fotografía, su descripción y su identificador persistieron.
3. **Orden y eliminación:** incorpore al menos dos fotos, desplace una hacia arriba o abajo y elimine otra después de aceptar la confirmación. Compruebe que la numeración visible comienza en 01 y sigue sin huecos.
4. **Exportación independiente:** desconecte el dispositivo de internet o deje fuera de alcance el servidor, exporte el `.docx` y ábralo. La imagen debe verse embebida y el archivo no puede depender de las fotos originales.
5. **Validación de exportación:** intente exportar sin completar un dato obligatorio o dejando una descripción vacía. El sistema debe impedir la descarga e indicar el dato o fotografía pendiente.
6. **Aislamiento de proyectos:** cree y guarde un segundo proyecto, sin mezclar fotografías ni descripciones del primero. Abra ambos proyectos en sucesión y confirme que cada uno conserva únicamente sus propias fotos.

Estas pruebas deben ejecutarse en el dispositivo objetivo, no únicamente en el computador de escritorio.
