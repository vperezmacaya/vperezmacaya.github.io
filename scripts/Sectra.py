import os
import sys
import re
import pandas as pd
from playwright.sync_api import sync_playwright

# Configurar salida estándar en UTF-8 para evitar errores de codificación en Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def clean_text(val: str) -> str:
    """Limpia espacios en blanco y caracteres de separación."""
    if not val:
        return ""
    return re.sub(r'\s+', ' ', str(val)).replace('\xa0', ' ').strip()


def parse_field(pattern: str, text: str, default: str = "") -> str:
    """Busca un patrón en el texto multilínea y retorna el valor limpio."""
    match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
    if match:
        return clean_text(match.group(1))
    return default


def normalize_inversion(raw_val: str) -> tuple:
    """
    Normaliza el valor de inversión en bruto:
    - Traspasa los valores de inversión a número (float/int).
    - Elimina casos con ',00' o ',0' al final.
    - Maneja casos con dos números separados por '/' sumándolos (Opción 1).
    - Extrae la moneda (UF, MM$, M$, USD, CLP) o asigna 'UF' por defecto si hay número sin moneda.
    - Si es 'S/I' o texto sin números, retorna (None, "").
    
    Retorna: (inversion_numerica, moneda)
    """
    if not raw_val or pd.isna(raw_val):
        return None, ""
        
    s = str(raw_val).strip()
    if not s or s.upper() == 'S/I' or s.lower() == 'nan':
        return None, ""
        
    # 1. Detectar Moneda
    moneda = "UF" # Por defecto si hay número
    if "MM$" in s.upper():
        moneda = "MM$"
    elif "M$" in s.upper():
        moneda = "M$"
    elif "USD" in s.upper() or "US$" in s.upper():
        moneda = "USD"
    elif "$" in s:
        moneda = "CLP"
    elif "UF" in s.upper():
        moneda = "UF"
        
    # 2. Manejo de casos con dos números separados por '/' (Opción 1: Sumar componentes)
    if "/" in s and not s.upper() == "S/I":
        parts = s.split("/")
        nums = []
        for p in parts:
            clean_p = re.sub(r'[^\d,\.]', '', p).strip()
            clean_p = re.sub(r',00$', '', clean_p)
            clean_p = re.sub(r',0$', '', clean_p)
            clean_p = clean_p.replace('.', '').replace(',', '.')
            try:
                nums.append(float(clean_p))
            except Exception:
                pass
        if nums:
            total = sum(nums)
            return (int(total) if total.is_integer() else total), moneda
        return None, ""
        
    # 3. Quitar texto de monedas o palabras
    clean_s = re.sub(r'(?i)\b(UF|MM\$|M\$|USD|US\$|\$)\b', '', s).strip()
    
    # Si contiene texto sin ningún número válido
    if not re.search(r'\d', clean_s):
        return None, ""
        
    # 4. Quitar ,00 o ,0 al final
    clean_s = re.sub(r',00\b', '', clean_s)
    clean_s = re.sub(r',0\b', '', clean_s)
    
    # 5. Normalizar separadores de miles y decimales
    if '.' in clean_s and ',' in clean_s:
        # Formato chileno 1.234,56
        clean_s = clean_s.replace('.', '').replace(',', '.')
    elif '.' in clean_s:
        parts = clean_s.split('.')
        if len(parts) > 1 and len(parts[-1]) == 3: # 299.322 o 1.534.511
            clean_s = clean_s.replace('.', '')
        elif len(parts) > 1 and len(parts[-1]) <= 2: # 4.3 (decimal)
            pass
    elif ',' in clean_s:
        parts = clean_s.split(',')
        if len(parts) > 1 and len(parts[-1]) == 3: # 185,008 (miles)
            clean_s = clean_s.replace(',', '')
        else: # 274,92 (decimal)
            clean_s = clean_s.replace(',', '.')
            
    clean_s = re.sub(r'[^\d\.]', '', clean_s)
    
    try:
        num = float(clean_s)
        return (int(num) if num.is_integer() else num), moneda
    except Exception:
        return None, ""


def parse_project_details(content_text: str) -> dict:
    """
    Parsea los campos clave del texto de un proyecto individual:
    - Inversión
    - TIR
    - Mandante
    - Estado
    - Descripción
    """
    inversion = parse_field(r'Inversi[oó]n\s*:\s*(.*?)(?=(?:TIR\s*:|Mandante\s*:|Estado\s*:|Descripci[oó]n\s*:|$))', content_text)
    tir = parse_field(r'TIR\s*:\s*(.*?)(?=(?:Inversi[oó]n\s*:|Mandante\s*:|Estado\s*:|Descripci[oó]n\s*:|$))', content_text)
    mandante = parse_field(r'Mandante\s*:\s*(.*?)(?=(?:Inversi[oó]n\s*:|TIR\s*:|Estado\s*:|Descripci[oó]n\s*:|$))', content_text)
    estado = parse_field(r'Estado\s*:\s*(.*?)(?=(?:Inversi[oó]n\s*:|TIR\s*:|Mandante\s*:|Descripci[oó]n\s*:|$))', content_text)
    
    desc_match = re.search(r'Descripci[oó]n\s*:\s*(.*)', content_text, re.IGNORECASE | re.DOTALL)
    if desc_match:
        descripcion = clean_text(desc_match.group(1))
    else:
        descripcion = ""
        
    return {
        "inversion": inversion,
        "tir": tir,
        "mandante": mandante,
        "estado": estado,
        "descripcion": descripcion
    }


def parse_indicators_advanced(pane_text: str, raw_html: str = "") -> dict:
    """
    Parsea exhaustivamente los indicadores demográficos, de movilidad
    y de síntesis del plan maestro combinando análisis DOM HTML y expresiones regulares.
    """
    text = pane_text.replace('\xa0', ' ')
    
    # 1. Indicadores demográficos y sociales
    poblacion = ""
    m_pob = re.search(r'Poblaci[oó]n\s*:\s*([\d\.,\s]+)', text, re.IGNORECASE)
    if m_pob:
        poblacion = clean_text(m_pob.group(1))
        
    hogares = ""
    m_hog = re.search(r'Hogares\s*:\s*([\d\.,\s]+)', text, re.IGNORECASE)
    if m_hog:
        hogares = clean_text(m_hog.group(1))
        
    # 2. Indicadores de movilidad
    vehiculos = ""
    m_veh = re.search(r'Veh[ií]culos\s+privados\s*:\s*([\d\.,\s]+)', text, re.IGNORECASE)
    if m_veh:
        vehiculos = clean_text(m_veh.group(1))
        
    redes_viales = ""
    m_red = re.search(r'Redes\s+[Vv]iales\s*:\s*([\d\.,\s]+(?:\s*km)?)', text, re.IGNORECASE)
    if m_red:
        redes_viales = clean_text(m_red.group(1))
        
    viajes_diarios = ""
    m_via = re.search(r'Viajes\s+diarios\s*:\s*([\d\.,\s]+)', text, re.IGNORECASE)
    if m_via:
        viajes_diarios = clean_text(m_via.group(1))
        
    # 3. Síntesis del plan maestro: Plazo de ejecución
    plazo_ejecucion = ""
    
    # Patrón A (en HTML): capturar el bloque previo a "Plazo de Ejecución"
    m_html_plazo = re.search(r'>\s*([^<>\n\r]+?)\s*<\/[^>]+>\s*<[^>]+>\s*(?:<[^>]+>)*\s*Plazo\s+de\s+Ejecuci[oó]n', raw_html, re.IGNORECASE)
    if m_html_plazo:
        cand = m_html_plazo.group(1).strip()
        if not any(k in cand.lower() for k in ['sintesis', 'síntesis', 'plan']):
            plazo_ejecucion = cand
            
    # Patrón B (en Texto plano):
    if not plazo_ejecucion:
        m_txt_plazo = re.search(r'(?:S[ií]ntesis\s+del\s+plan)?\s*([^\n\r:]{1,30}?)\s*Plazo\s+de\s+Ejecuci[oó]n', text, re.IGNORECASE)
        if m_txt_plazo:
            cand = m_txt_plazo.group(1).strip()
            cand = re.sub(r'^.*?plan\s*', '', cand, flags=re.IGNORECASE).strip()
            if cand and not any(k in cand.lower() for k in ['sintesis', 'síntesis']):
                plazo_ejecucion = cand
                
    # Patrón C: "Plazo de Ejecución: ..."
    if not plazo_ejecucion:
        m_txt_plazo2 = re.search(r'Plazo\s+de\s+Ejecuci[oó]n\s*:\s*([^\n\r]+)', text, re.IGNORECASE)
        if m_txt_plazo2:
            plazo_ejecucion = m_txt_plazo2.group(1).strip()

    # 4. Síntesis del plan maestro: Valor de la cartera
    valor_cartera = ""
    # Patrón A (en HTML):
    m_html_cart = re.search(r'>\s*([\d\.,]+)\s*<\/[^>]+>\s*<[^>]+>\s*(?:<[^>]+>)*\s*Valor\s+de\s+la\s+cartera', raw_html, re.IGNORECASE)
    if m_html_cart:
        valor_cartera = m_html_cart.group(1).strip()
    
    # Patrón B (en Texto):
    if not valor_cartera:
        m_txt_cart = re.search(r'([\d\.,]+)\s*(?:[\r\n\s]+)?Valor\s+de\s+la\s+cartera', text, re.IGNORECASE)
        if m_txt_cart:
            valor_cartera = m_txt_cart.group(1).strip()
            
    # Patrón C: "Valor de la cartera: 4,3..."
    if not valor_cartera:
        m_txt_cart2 = re.search(r'Valor\s+de\s+la\s+cartera[^\n\r:]*:\s*([\d\.,]+(?:\s*(?:Millones\s+de\s+UF|UF|M\$))?)', text, re.IGNORECASE)
        if m_txt_cart2:
            valor_cartera = m_txt_cart2.group(1).strip()
            
    if valor_cartera and not 'UF' in valor_cartera.upper():
        valor_cartera += " Millones de UF"
        
    return {
        "Población": poblacion,
        "Hogares": hogares,
        "Vehículos privados": vehiculos,
        "Redes viales": redes_viales,
        "Viajes diarios": viajes_diarios,
        "Plazo de ejecución": plazo_ejecucion,
        "Valor de la cartera": valor_cartera
    }


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'Bases de dato')
os.makedirs(DATA_DIR, exist_ok=True)


def extraer_proyectos_y_conurbaciones(output_excel: str = None, headless: bool = False, slow_mo: int = 100):
    if output_excel is None:
        output_excel = os.path.join(DATA_DIR, "Proyectos_SECTRA.xlsx")
    elif not os.path.isabs(output_excel):
        output_excel = os.path.join(DATA_DIR, output_excel)
    print("=" * 75)
    print(f"INICIANDO EXTRACCION COMPLETA SECTRA (Modo visual: {'DESACTIVADO' if headless else 'ACTIVADO'})")
    print("=" * 75)
    
    todos_los_proyectos = []
    todas_las_conurbaciones = []
    
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=headless,
            slow_mo=slow_mo if not headless else 0
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        
        # 1. Obtener la lista de todas las regiones desde la página principal
        print("\n[1/3] Conectando a https://www.sectra.gob.cl/planes-y-proyectos/...")
        page.goto("https://www.sectra.gob.cl/planes-y-proyectos/", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(1000)
        
        region_links = page.eval_on_selector_all(
            '#brxe-oaweoj ul a',
            '''elements => elements.map(e => ({
                name: e.innerText.trim(),
                url: e.href
            }))'''
        )
        
        if not region_links:
            region_links = page.eval_on_selector_all(
                'a[href*="/plan-y-proyecto/region-"]',
                '''elements => elements.map(e => ({
                    name: e.innerText.trim(),
                    url: e.href
                }))'''
            )
            
        print(f"[OK] Se encontraron {len(region_links)} regiones para procesar.\n")
        
        # 2. Iterar por cada región y extraer proyectos + indicadores urbanos
        print("[2/3] Extrayendo datos por región, área urbana y proyectos...")
        for i, reg in enumerate(region_links, 1):
            url = reg["url"]
            print(f"\n({i}/{len(region_links)}) Procesando: {url}")
            
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(1000)
                
                # Obtener el nombre limpio de la región
                region_name = page.evaluate('''() => {
                    const headings = Array.from(document.querySelectorAll('h1, h2, h3, .brxe-heading'));
                    for (let h of headings) {
                        const t = h.innerText.trim();
                        if (t.toLowerCase().includes('regi') && !t.toLowerCase().includes('planes')) {
                            return t;
                        }
                    }
                    const breadcrumb = document.querySelector('.brx-breadcrumb, .breadcrumb, [class*="breadcrumb"]');
                    if (breadcrumb) {
                        const items = Array.from(breadcrumb.querySelectorAll('li, a, span'));
                        if (items.length > 0) return items[items.length - 1].innerText.trim();
                    }
                    return document.title.replace(' - Sectra', '').trim();
                }''')
                
                if not region_name or "planes" in region_name.lower():
                    slug = url.strip("/").split("/")[-1].replace("region-de-", "").replace("region-del-", "").replace("region-", "").replace("-", " ").title()
                    region_name = f"Región de {slug}"
                    
                # A. Extraer estructura de áreas / conurbaciones (pestañas, su texto y su HTML)
                areas_info = page.evaluate('''() => {
                    const results = [];
                    const tabsContainer = document.querySelector('.brxe-tabs-nested, .brx-tabs-nested, .brxe-tabs, [data-script="bricksTabs"]');
                    
                    if (tabsContainer) {
                        const panes = Array.from(tabsContainer.querySelectorAll('.brxe-tab-pane, .tab-pane, [class*="tab-pane"], .brx-tab-pane'));
                        const tabMenuItems = Array.from(tabsContainer.querySelectorAll('.brx-tab-title, .tab-title, .brxe-tab-menu li, .tab-menu li, [class*="tab-title"]'));
                        
                        panes.forEach((pane, idx) => {
                            let cityName = '';
                            if (idx < tabMenuItems.length) {
                                cityName = tabMenuItems[idx].innerText.trim();
                            }
                            results.push({
                                cityName: cityName,
                                paneText: pane.innerText,
                                paneHtml: pane.innerHTML
                            });
                        });
                    }
                    return results;
                }''')
                
                # Procesar indicadores por área urbana con el parser avanzado
                for area in areas_info:
                    city = area['cityName']
                    if not city or 'colores de las rutas' in city.lower():
                        continue
                    indicators = parse_indicators_advanced(area['paneText'], area.get('paneHtml', ''))
                    todas_las_conurbaciones.append({
                        "Región": region_name,
                        "Ciudad / Conurbación": city,
                        "Población": indicators["Población"],
                        "Hogares": indicators["Hogares"],
                        "Vehículos privados": indicators["Vehículos privados"],
                        "Redes viales": indicators["Redes viales"],
                        "Viajes diarios": indicators["Viajes diarios"],
                        "Plazo de ejecución": indicators["Plazo de ejecución"],
                        "Valor de la cartera": indicators["Valor de la cartera"],
                        "Fuente URL": url
                    })
                    
                # B. Extraer todos los proyectos individuales
                proyectos_pagina = page.evaluate('''() => {
                    const data = [];
                    const accordions = Array.from(document.querySelectorAll('.accordion-title-wrapper, [class*="accordion-title"]'));
                    
                    accordions.forEach((titleEl) => {
                        const titleText = titleEl.innerText.trim();
                        if (!titleText) return;
                        
                        let detectedCity = '';
                        let parentPane = titleEl.closest('.brxe-tab-pane, .tab-pane, [class*="tab-pane"], .brx-tab-pane');
                        if (parentPane) {
                            const tabsContainer = parentPane.closest('.brxe-tabs-nested, .brx-tabs-nested, .brxe-tabs, [data-script="bricksTabs"]');
                            if (tabsContainer) {
                                const panes = Array.from(tabsContainer.querySelectorAll('.brxe-tab-pane, .tab-pane, [class*="tab-pane"], .brx-tab-pane'));
                                const paneIndex = panes.indexOf(parentPane);
                                const tabMenuItems = Array.from(tabsContainer.querySelectorAll('.brx-tab-title, .tab-title, .brxe-tab-menu li, .tab-menu li, [class*="tab-title"]'));
                                if (paneIndex >= 0 && paneIndex < tabMenuItems.length) {
                                    detectedCity = tabMenuItems[paneIndex].innerText.trim();
                                }
                            }
                        }
                        
                        if (!detectedCity) {
                            let prev = titleEl.parentElement;
                            while (prev && prev !== document.body) {
                                let sibling = prev.previousElementSibling;
                                while (sibling) {
                                    const heading = sibling.matches('h2, h3, h4, .brxe-heading') ? sibling : sibling.querySelector('h2, h3, h4, .brxe-heading');
                                    if (heading) {
                                        const hText = heading.innerText.trim();
                                        if (hText && !hText.toLowerCase().includes('plan') && !hText.toLowerCase().includes('regi')) {
                                            detectedCity = hText;
                                            break;
                                        }
                                    }
                                    sibling = sibling.previousElementSibling;
                                }
                                if (detectedCity) break;
                                prev = prev.parentElement;
                            }
                        }
                        
                        let contentEl = titleEl.nextElementSibling;
                        if (!contentEl || !contentEl.classList.contains('accordion-content-wrapper')) {
                            if (titleEl.parentElement) {
                                contentEl = titleEl.parentElement.querySelector('.accordion-content-wrapper, [class*="accordion-content"]');
                            }
                        }
                        
                        const contentText = contentEl ? contentEl.innerText.trim() : '';
                        data.push({
                            title: titleText,
                            city: detectedCity,
                            content: contentText
                        });
                    });
                    
                    return data;
                }''')
                
                ciudades_encontradas = list(set([p['city'] for p in proyectos_pagina if p['city']]))
                print(f"   -> {region_name} | Proyectos: {len(proyectos_pagina)} | Áreas/Ciudades: {ciudades_encontradas}")
                
                for p_idx, item in enumerate(proyectos_pagina, 1):
                    parsed = parse_project_details(item["content"])
                    inv_num, moneda = normalize_inversion(parsed["inversion"])
                    registro = {
                        "Región": region_name,
                        "Ciudad / Área": item["city"],
                        "N°": p_idx,
                        "Proyecto": item["title"],
                        "Inversión": inv_num,
                        "Moneda": moneda,
                        "TIR": parsed["tir"],
                        "Mandante": parsed["mandante"],
                        "Estado": parsed["estado"],
                        "Descripción": parsed["descripcion"],
                        "Fuente URL": url
                    }
                    todos_los_proyectos.append(registro)
                    
            except Exception as e:
                print(f"   [ERROR] al procesar {url}: {e}")
                
        context.close()
        browser.close()
        
    # 3. Guardar en Excel en 2 hojas con formato estilizado
    print("\n" + "=" * 75)
    print(f"[3/3] Guardando información en Excel ({len(todos_los_proyectos)} proyectos, {len(todas_las_conurbaciones)} conurbaciones)...")
    
    df_proyectos = pd.DataFrame(todos_los_proyectos)
    df_conurbaciones = pd.DataFrame(todas_las_conurbaciones)
    
    target_file = output_excel
    saved = False
    
    for attempt_path in [output_excel, output_excel.replace('.xlsx', '_actualizado.xlsx')]:
        try:
            with pd.ExcelWriter(attempt_path, engine="openpyxl") as writer:
                # Hoja 1: Proyectos
                df_proyectos.to_excel(writer, index=False, sheet_name="Proyectos SECTRA")
                ws1 = writer.sheets["Proyectos SECTRA"]
                for col in ws1.columns:
                    max_len = 0
                    col_letter = col[0].column_letter
                    for cell in col:
                        val_str = str(cell.value or "")
                        if len(val_str) > max_len:
                            max_len = len(val_str)
                    if col_letter in ['D', 'J']: # Proyecto o Descripción
                        ws1.column_dimensions[col_letter].width = min(max(max_len + 3, 15), 60)
                    elif col_letter == 'B': # Ciudad / Área
                        ws1.column_dimensions[col_letter].width = max(max_len + 3, 22)
                    elif col_letter == 'E': # Inversión numérica
                        ws1.column_dimensions[col_letter].width = max(max_len + 3, 14)
                    elif col_letter == 'F': # Moneda
                        ws1.column_dimensions[col_letter].width = 10
                    else:
                        ws1.column_dimensions[col_letter].width = max(max_len + 3, 10)
                
                # Hoja 2: Conurbaciones e Indicadores
                df_conurbaciones.to_excel(writer, index=False, sheet_name="Info por Conurbación")
                ws2 = writer.sheets["Info por Conurbación"]
                for col in ws2.columns:
                    max_len = 0
                    col_letter = col[0].column_letter
                    for cell in col:
                        val_str = str(cell.value or "")
                        if len(val_str) > max_len:
                            max_len = len(val_str)
                    ws2.column_dimensions[col_letter].width = max(max_len + 3, 16)
                    
            target_file = attempt_path
            saved = True
            break
        except PermissionError:
            print(f"[AVISO] '{attempt_path}' está abierto por otro programa. Intentando nombre alternativo...")
            
    if saved:
        print(f"[EXITO] Archivo generado correctamente: {os.path.abspath(target_file)}")
        print(f" - Hoja 1 ('Proyectos SECTRA'): {len(df_proyectos)} filas")
        print(f" - Hoja 2 ('Info por Conurbación'): {len(df_conurbaciones)} filas")
    else:
        print("[ERROR] No se pudo escribir el archivo Excel. Por favor cierra Excel y vuelve a intentar.")
        
    print("=" * 75)


if __name__ == "__main__":
    extraer_proyectos_y_conurbaciones(output_excel="Proyectos_SECTRA.xlsx", headless=False, slow_mo=80)
