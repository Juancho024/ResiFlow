import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Modal,
    Image,
    ActivityIndicator,
    useWindowDimensions,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { ResiAlert, SessionStore, UserSession } from '../(auth)/login';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';

const API_BASE = 'https://www.jrtechnology.duckdns.org/systemmanager/api';

interface FilaContabilidad {
    apto: string;
    propietario: string;
    cuotaMensual: number;
    descripcion: string;
    montoPagar: number;
    balance: number;
}

interface MesContable {
    id?: number;
    mesAnio: string;
    montoFinalRecibos?: number;
    facturasUris?: Array<string | null>;
    filas: FilaContabilidad[];
}

interface LecturaGasItem {
    id?: number;
    apto: string;
    responsable: string;
    pagador: string;
    ant: number;
    act: string;
    estado: string;
    fecha?: string;
    modificado?: boolean;
}

const aBase64Puro = (uri: string | null): string | null => {
    if (!uri) return null;
    const partes = uri.split(',');
    return partes.length > 1 ? partes[1] : uri;
};

const desdeBase64Puro = (b64: string | null | undefined): string | null => {
    if (!b64) return null;
    if (b64.startsWith('data:image') || b64.startsWith('http')) return b64;
    return `data:image/jpeg;base64,${b64}`;
};

export default function FacturacionScreen() {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isDesktop = width >= 900;
    const [session, setSession] = useState<UserSession | null>(() => SessionStore.getSession());
    const idResidencial = session?.idResidencial || 1;
    const { colors, darkMode } = useAppTheme();

    const [vistaActiva, setVistaActiva] = useState<'CONTABILIDAD' | 'GAS'>('CONTABILIDAD');
    const [cargando, setCargando] = useState(false);
    const [guardandoModal, setGuardandoModal] = useState(false);
    const [enviandoGasApto, setEnviandoGasApto] = useState<string | null>(null);

    const [busquedaMes, setBusquedaMes] = useState('');
    const [propietariosBase, setPropietariosBase] = useState<any[]>([]);
    const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);
    const [historialMeses, setHistorialMeses] = useState<MesContable[]>([]);

    const [modalVisible, setModalVisible] = useState(false);
    const [modoModal, setModoModal] = useState<'REGISTRAR' | 'ACTUALIZAR'>('REGISTRAR');
    const [registroEditandoId, setRegistroEditandoId] = useState<number | undefined>(undefined);
    const [dropdownAbierto, setDropdownAbierto] = useState(false);

    const [cuotaDelMes, setCuotaDelMes] = useState('');
    const [montoCuota, setMontoCuota] = useState('');
    const [checkAgua, setCheckAgua] = useState(false);
    const [checkMant, setCheckMant] = useState(false);
    const [checkLuz, setCheckLuz] = useState(false);
    const [checkOtros, setCheckOtros] = useState(false);
    const [textoOtros, setTextoOtros] = useState('');
    const [montoFinal, setMontoFinal] = useState('');
    const [facturasUris, setFacturasUris] = useState<Array<string | null>>([null, null, null, null]);

    const [precioM3, setPrecioM3] = useState('137.20');
    const [mensajeGasEnviado, setMensajeGasEnviado] = useState<string | null>(null);
    const [lecturasGas, setLecturasGas] = useState<LecturaGasItem[]>([]);

    useEffect(() => {
        const currentSession = SessionStore.getSession();
        if (currentSession) {
            setSession(currentSession);
        }
        void cargarTodoDesdeAPI();
    }, []);

    const cargarTodoDesdeAPI = async () => {
        setCargando(true);
        try {
            const [resMeses, resProp, resFin, resGas] = await Promise.all([
                fetch(`${API_BASE}/mescuotas?idResidencial=${idResidencial}`).catch(() => null),
                fetch(`${API_BASE}/propietarios?idResidencial=${idResidencial}`).catch(() => null),
                fetch(`${API_BASE}/registro-financiero?idResidencial=${idResidencial}`).catch(() => null),
                fetch(`${API_BASE}/registro-gas?idResidencial=${idResidencial}`).catch(() => null),
            ]);

            if (resMeses?.ok) {
                const dataMeses = await resMeses.json();
                setMesesDisponibles(dataMeses.map((m: any) => m.mesAnio || m));
            }

            let listaProps: any[] = [];
            if (resProp?.ok) {
                const dataProp = await resProp.json();
                listaProps = dataProp.map((p: any) => ({
                    ...p,
                    apto: p.apto || p.numApto || 'S/N',
                    propietario: String(p.nombre || p.nombrePropietario || 'Propietario').replace(/\s+/g, ' ').trim(),
                    balance: parseFloat(p.balance ?? p.saldoPendiente ?? 0),
                    estado: p.estado,
                }));
                setPropietariosBase(listaProps);
            }

            if (resFin?.ok && listaProps.length > 0) {
                const dataFin = await resFin.json();

                const registrosOrdenados = dataFin.slice().sort((a: any, b: any) => a.id - b.id);
                let sumaCobrosFuturos = 0;

                const mesesMapeados: MesContable[] = registrosOrdenados.reverse().map((reg: any) => {
                    const cuota = parseFloat(reg.cuotaMensual ?? 0);
                    const montoPagarReg = parseFloat(reg.montoPagar ?? cuota);

                    const filas = listaProps.map((p) => {
                        const balanceHistorico = p.balance + sumaCobrosFuturos;

                        return {
                            apto: p.apto,
                            propietario: p.propietario,
                            cuotaMensual: cuota,
                            descripcion: reg.descripcion,
                            montoPagar: montoPagarReg,
                            balance: balanceHistorico,
                        };
                    });

                    sumaCobrosFuturos += montoPagarReg;

                    return {
                        id: reg.id,
                        mesAnio: (reg.mesCuota || 'octubre-2026').toLowerCase(),
                        montoFinalRecibos: montoPagarReg,
                        facturasUris: [
                            desdeBase64Puro(reg.img1),
                            desdeBase64Puro(reg.img2),
                            desdeBase64Puro(reg.img3),
                            desdeBase64Puro(reg.img4),
                        ],
                        filas: filas,
                    };
                });

                setHistorialMeses(mesesMapeados);
            }

            if (resGas?.ok && listaProps.length > 0) {
                const dataGas = await resGas.json();
                const mapeoGas: LecturaGasItem[] = listaProps.map((lp) => {
                    const registrosApto = dataGas.filter(
                        (rg: any) => (rg.apto || '').toUpperCase() === lp.apto.toUpperCase()
                    );
                    const ultimo = registrosApto[registrosApto.length - 1];

                    if (ultimo) {
                        return {
                            id: ultimo.id,
                            apto: lp.apto,
                            responsable: lp.propietario,
                            pagador: 'PROPIETARIO',
                            ant: parseFloat(ultimo.balanceAnterior ?? ultimo.balanceanterior ?? 0),
                            act: String(parseFloat(ultimo.balanceNuevo ?? ultimo.balancenuevo ?? 0)),
                            estado: (ultimo.estado || 'PENDIENTE').toUpperCase(),
                            fecha: ultimo.fecha,
                            modificado: false,
                        };
                    }

                    return {
                        id: undefined,
                        apto: lp.apto,
                        responsable: lp.propietario,
                        pagador: 'PROPIETARIO',
                        ant: 0,
                        act: '0',
                        estado: 'N/A',
                        modificado: false,
                    };
                });
                setLecturasGas(mapeoGas);
            }
        } catch (error) {
            ResiAlert.error('Error de Sincronización', 'No se pudieron cargar los registros contables.');
        } finally {
            setCargando(false);
        }
    };

    const textoBusquedaLimpio = busquedaMes.trim().toLowerCase();
    const tieneMesEscrito = textoBusquedaLimpio.length > 0;
    const mesActualObj = tieneMesEscrito
        ? historialMeses.find((m) => m.mesAnio.toLowerCase().includes(textoBusquedaLimpio)) || historialMeses[0]
        : historialMeses[0];

    const handleAccionPrincipal = () => {
        setDropdownAbierto(false);
        if (!tieneMesEscrito) {
            setModoModal('REGISTRAR');
            setRegistroEditandoId(undefined);
            setCuotaDelMes('');
            setMontoCuota('');
            setCheckAgua(false);
            setCheckMant(false);
            setCheckLuz(false);
            setCheckOtros(false);
            setTextoOtros('');
            setMontoFinal('');
            setFacturasUris([null, null, null, null]);
            setModalVisible(true);
        } else {
            setModoModal('ACTUALIZAR');
            const existente = historialMeses.find(
                (m) =>
                    m.mesAnio.toLowerCase() === textoBusquedaLimpio ||
                    m.mesAnio.toLowerCase().includes(textoBusquedaLimpio)
            );
            if (existente) {
                const primeraFila = existente.filas[0];
                const desc = primeraFila?.descripcion || '';
                const descLower = desc.toLowerCase();
                const partesExtras = desc
                    .split(',')
                    .map((s) => s.trim())
                    .filter(
                        (s) =>
                            s &&
                            !s.toLowerCase().includes('agua') &&
                            !s.toLowerCase().includes('luz') &&
                            !s.toLowerCase().includes('mantenimiento')
                    );

                setRegistroEditandoId(existente.id);
                setCuotaDelMes(existente.mesAnio);
                setMontoCuota(primeraFila ? String(primeraFila.cuotaMensual) : '');
                setCheckAgua(descLower.includes('agua'));
                setCheckMant(descLower.includes('mantenimiento'));
                setCheckLuz(descLower.includes('luz'));
                setCheckOtros(partesExtras.length > 0);
                setTextoOtros(partesExtras.join(', '));
                setMontoFinal(
                    existente.montoFinalRecibos
                        ? String(existente.montoFinalRecibos)
                        : primeraFila
                            ? String(primeraFila.montoPagar)
                            : ''
                );
                setFacturasUris(existente.facturasUris || [null, null, null, null]);
            }
            setModalVisible(true);
        }
    };

    const seleccionarArchivosFacturas = async () => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/png, image/jpeg';
            input.multiple = true;
            input.onchange = (e: any) => {
                const files = Array.from(e.target?.files || []).slice(0, 4) as File[];
                files.forEach((file, idx) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        setFacturasUris((prev) => {
                            const copia = [...prev];
                            const slotLibre = copia.findIndex((x) => x === null);
                            const pos = slotLibre !== -1 ? slotLibre : idx;
                            if (pos < 4) copia[pos] = reader.result as string;
                            return copia;
                        });
                    };
                    reader.readAsDataURL(file);
                });
                ResiAlert.toast('Facturas adjuntadas al periodo contable', 'INFO');
            };
            input.click();
        } else {
            try {
                const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
                let finalStatus = existingStatus;
                if (existingStatus !== 'granted') {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    finalStatus = status;
                }
                if (finalStatus !== 'granted') {
                    ResiAlert.warning('Permiso Requerido', 'Necesitamos acceso a tus fotos para adjuntar facturas.');
                    return;
                }

                const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    allowsMultipleSelection: true,
                    quality: 0.7,
                    base64: true,
                });

                if (!result.canceled && result.assets) {
                    const nuevasUris = result.assets.slice(0, 4).map((asset) =>
                        asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri
                    );

                    setFacturasUris((prev) => {
                        const copia = [...prev];
                        nuevasUris.forEach((uri) => {
                            const slotLibre = copia.findIndex((x) => x === null);
                            if (slotLibre !== -1) copia[slotLibre] = uri;
                        });
                        return copia;
                    });
                    ResiAlert.toast('Facturas adjuntadas correctamente', 'SUCCESS');
                }
            } catch (err) {
                console.error('Error abriendo galería:', err);
                ResiAlert.error('Error', 'No se pudo abrir la galería de imágenes.');
            }
        }
    };

    const eliminarImagenFactura = (indice: number) => {
        setFacturasUris((prev) => prev.map((img, i) => (i === indice ? null : img)));
    };

    const enviarCobroGasPropietario = async (itemGas: LecturaGasItem, idx: number, totalCobro: number) => {
        setEnviandoGasApto(itemGas.apto);
        const lecturaNuevaNum = parseFloat(itemGas.act) || itemGas.ant;
        const fechaHoy = new Date().toISOString().split('T')[0];

        const payloadGas = {
            idResidencial,
            fecha: fechaHoy,
            apto: itemGas.apto,
            balanceanterior: itemGas.ant,
            balancenuevo: lecturaNuevaNum,
            totalapagar: parseFloat(totalCobro.toFixed(2)),
            estado: 'PENDIENTE',
        };

        try {
            const url = itemGas.id ? `${API_BASE}/registro-gas/${itemGas.id}` : `${API_BASE}/registro-gas`;
            const response = await fetch(url, {
                method: itemGas.id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadGas),
            });

            if (response.ok) {
                const guardado = await response.json();
                setLecturasGas((prev) =>
                    prev.map((item, i) =>
                        i === idx
                            ? { ...item, id: guardado.id ?? item.id, estado: 'PENDIENTE', modificado: false }
                            : item
                    )
                );
                setMensajeGasEnviado(`✓ Cobro de gas enviado para ${itemGas.responsable} (${itemGas.apto})`);
                ResiAlert.toast(
                    `Recibo de Gas GLP (RD$ ${totalCobro.toFixed(2)}) enviado a Apto ${itemGas.apto}`,
                    'SUCCESS'
                );
            } else {
                ResiAlert.error('Error', `No se pudo guardar la lectura para ${itemGas.apto}.`);
            }
        } catch (error) {
            ResiAlert.error('Fallo', 'Problema al enviar gas.');
        } finally {
            setEnviandoGasApto(null);
            setTimeout(() => setMensajeGasEnviado(null), 4000);
        }
    };

    const guardarRegistroModal = async () => {
        if (!cuotaDelMes && !textoBusquedaLimpio) {
            ResiAlert.warning('Periodo Requerido', 'Selecciona un mes disponible.');
            return;
        }

        const mesObjetivo = (cuotaDelMes || textoBusquedaLimpio).trim().toLowerCase();
        const cuotaNum = parseFloat(montoCuota) || 858.0;
        const finalNum = parseFloat(montoFinal) || cuotaNum;

        const conceptos: string[] = [];
        if (checkAgua) conceptos.push('Se pago el agua');
        if (checkLuz) conceptos.push('Se pago la luz');
        if (checkMant) conceptos.push('Se pago mantenimiento');
        if (checkOtros && textoOtros.trim()) conceptos.push(textoOtros.trim());
        const descripcionFinal = conceptos.length > 0 ? conceptos.join(', ') : 'Cuota mensual registrada';

        const payloadFinanciero = {
            idResidencial,
            mesCuota: mesObjetivo,
            cuotaMensual: cuotaNum,
            descripcion: descripcionFinal,
            montoPagar: finalNum,
            img1: aBase64Puro(facturasUris[0]),
            img2: aBase64Puro(facturasUris[1]),
            img3: aBase64Puro(facturasUris[2]),
            img4: aBase64Puro(facturasUris[3]),
        };

        setGuardandoModal(true);
        try {
            const esPut = modoModal === 'ACTUALIZAR' && registroEditandoId !== undefined;
            const url = esPut
                ? `${API_BASE}/registro-financiero/${registroEditandoId}`
                : `${API_BASE}/registro-financiero`;

            const response = await fetch(url, {
                method: esPut ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadFinanciero),
            });

            if (response.ok) {
                if (!esPut) {
                    await fetch(`${API_BASE}/mescuotas/${mesObjetivo}?idResidencial=${idResidencial}`, {
                        method: 'DELETE',
                    });
                }

                await cargarTodoDesdeAPI();
                setModalVisible(false);
                ResiAlert.success(
                    esPut ? 'Actualizado' : 'Emitida',
                    `Registro de ${mesObjetivo.toUpperCase()} procesado.`
                );
            } else {
                ResiAlert.error('Error', 'El servidor rechazó el registro.');
            }
        } catch (error) {
            ResiAlert.error('Error de Conexión', 'Fallo de red al guardar.');
        } finally {
            setGuardandoModal(false);
        }
    };

    const construirHTMLInforme = (incluirAnexos: boolean, autoPrintWeb: boolean) => {
        if (!mesActualObj || !mesActualObj.filas) return '';

        let totalPendiente = 0;
        let totalRecibido = 0;

        const filasHTML = mesActualObj.filas
            .map((r, idx) => {
                if (r.balance < 0) totalPendiente += Math.abs(r.balance);
                if (r.balance >= 0) totalRecibido += r.montoPagar;

                const claseZebra = idx % 2 !== 0 ? 'class="zebra"' : '';
                const esAlDia = r.balance >= 0;

                return `
                <tr ${claseZebra}>
                    <td class="text-center"><b>${r.apto}</b></td>
                    <td>${r.propietario}</td>
                    <td class="text-center font-bold ${esAlDia ? 'c-verde' : 'c-rojo'}">${esAlDia ? 'AL DÍA' : 'PENDIENTE'}</td>
                    <td class="text-right">DOP$ ${r.montoPagar.toFixed(2)}</td>
                    <td class="text-right">DOP$ ${r.cuotaMensual.toFixed(2)}</td>
                    <td>${r.descripcion || ''}</td>
                    <td class="text-right font-bold">DOP$ ${r.montoPagar.toFixed(2)}</td>
                    <td class="text-right font-bold ${esAlDia ? '' : 'c-rojo'}">DOP$ ${r.balance.toFixed(2)}</td>
                </tr>`;
            })
            .join('');

        const anexosImagenesHTML = incluirAnexos
            ? mesActualObj.facturasUris
            ?.filter((uri) => uri)
            .map(
                (uri, idx) => `
                <div class="page-break"></div>
                <div class="img-container">
                    <div class="img-title">ANEXO DE PAGO #${idx + 1}</div>
                    <img src="${uri}" class="receipt-img" />
                </div>
            `
            )
            .join('') || ''
            : '';

        const fechaActual = new Date();
        const fechaStr = `${fechaActual.getDate().toString().padStart(2, '0')}/${(fechaActual.getMonth() + 1)
            .toString()
            .padStart(2, '0')}/${fechaActual.getFullYear()} ${fechaActual
            .getHours()
            .toString()
            .padStart(2, '0')}:${fechaActual.getMinutes().toString().padStart(2, '0')}`;

        return `
            <html>
                <head>
                    <meta charset="utf-8" />
                    <title>INFORME FINANCIERO - ${mesActualObj.mesAnio.toUpperCase()}</title>
                    <style>
                        @page { size: letter; margin: 15mm; }
                        body { font-family: 'Helvetica', 'Arial', sans-serif; color: #000; font-size: 11px; margin: 0; padding: 10px; }
                        .titulo-principal { text-align: center; color: #2C3E50; font-size: 18px; font-weight: bold; margin-bottom: 20px; }
                        .tabla-resumen { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        .tabla-resumen td { background-color: #2C3E50; text-align: center; padding: 12px; border: 2px solid white; }
                        .resumen-lbl { color: white; font-size: 11px; margin-bottom: 4px; }
                        .resumen-val { color: white; font-size: 16px; font-weight: bold; }
                        .val-rojo { color: #ff6666; }
                        .tabla-main { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        .tabla-main th { background-color: #2C3E50; color: white; padding: 8px; font-size: 11px; }
                        .tabla-main td { padding: 6px 8px; border-bottom: 1px solid #E2E8F0; font-size: 11px; }
                        .zebra { background-color: #F5F5F5; }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: bold; }
                        .c-verde { color: #27AE60; }
                        .c-rojo { color: #C0392B; }
                        .nota-titulo { font-size: 12px; font-weight: bold; margin-top: 20px; margin-bottom: 4px; }
                        .nota-lista { margin: 0; padding-left: 15px; font-size: 11px; line-height: 1.4; }
                        .footer { margin-top: 30px; width: 100%; font-size: 10px; color: gray; display: flex; justify-content: space-between; }
                        .page-break { page-break-before: always; }
                        .img-container { text-align: center; margin-top: 40px; }
                        .img-title { font-size: 16px; font-weight: bold; color: #2C3E50; margin-bottom: 20px; }
                        .receipt-img { max-width: 90%; max-height: 750px; border: 1px solid gray; }
                    </style>
                </head>
                <body>
                    <div class="titulo-principal">INFORME FINANCIERO - ${mesActualObj.mesAnio.toUpperCase()}</div>
                    <table class="tabla-resumen">
                        <tr>
                            <td><div class="resumen-lbl">TOTAL RECIBIDO</div><div class="resumen-val">DOP$ ${totalRecibido.toFixed(2)}</div></td>
                            <td><div class="resumen-lbl">CUOTA</div><div class="resumen-val">DOP$ ${(mesActualObj.filas[0]?.cuotaMensual || 0).toFixed(2)}</div></td>
                            <td><div class="resumen-lbl">A PAGAR</div><div class="resumen-val">DOP$ ${(mesActualObj.montoFinalRecibos || 0).toFixed(2)}</div></td>
                            <td><div class="resumen-lbl">PENDIENTE</div><div class="resumen-val val-rojo">DOP$ ${totalPendiente.toFixed(2)}</div></td>
                        </tr>
                    </table>
                    <table class="tabla-main">
                        <thead>
                            <tr>
                                <th>Apto</th>
                                <th style="text-align: left">Propietario</th>
                                <th>Estado</th>
                                <th style="text-align: right">Recibido</th>
                                <th style="text-align: right">Cuota</th>
                                <th style="text-align: left">Descripción</th>
                                <th style="text-align: right">A Pagar</th>
                                <th style="text-align: right">Balance</th>
                            </tr>
                        </thead>
                        <tbody>${filasHTML}</tbody>
                    </table>
                    <div class="footer">
                        <span>Generado el: ${fechaStr} | ResiFlow Administrativo</span>
                        <span>ResiFlow v4.5.2</span>
                    </div>
                    ${anexosImagenesHTML}
                    ${autoPrintWeb ? '<script>window.onload = function() { window.print(); }</script>' : ''}
                </body>
            </html>
        `;
    };

    const descargarIMGContabilidad = async () => {
        if (!mesActualObj || !mesActualObj.filas) {
            ResiAlert.warning('Sin Datos', 'No hay registros cargados.');
            return;
        }

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            let totalPendiente = 0;
            let totalRecibido = 0;

            mesActualObj.filas.forEach((r) => {
                if (r.balance < 0) totalPendiente += Math.abs(r.balance);
                if (r.balance >= 0) totalRecibido += r.montoPagar;
            });

            const fechaActual = new Date();
            const fechaStr = `${fechaActual.getDate().toString().padStart(2, '0')}/${(fechaActual.getMonth() + 1)
                .toString()
                .padStart(2, '0')}/${fechaActual.getFullYear()} ${fechaActual
                .getHours()
                .toString()
                .padStart(2, '0')}:${fechaActual.getMinutes().toString().padStart(2, '0')}`;

            const win = window.open('', '_blank');
            if (win) {
                win.document.write(`
                    <html>
                        <head>
                            <title>Generando Imagen...</title>
                            <style>
                                body { background: #f0f2f5; display: flex; flex-direction: column; align-items: center; font-family: sans-serif; padding: 20px; }
                                #canvas { display: none; }
                                .loading { font-size: 16px; font-weight: bold; color: #2C3E50; }
                            </style>
                        </head>
                        <body>
                            <div class="loading">Procesando y descargando imagen JPG de alta calidad...</div>
                            <canvas id="canvas"></canvas>
                            <script>
                                window.onload = function() {
                                    const canvas = document.getElementById('canvas');
                                    const ctx = canvas.getContext('2d');
                                    const mesCuota = "${mesActualObj.mesAnio.toUpperCase()}";
                                    const totalRecibido = ${totalRecibido};
                                    const cuota = ${mesActualObj.filas[0]?.cuotaMensual || 0};
                                    const aPagar = ${mesActualObj.montoFinalRecibos || 0};
                                    const pendiente = ${totalPendiente};
                                    const filas = ${JSON.stringify(mesActualObj.filas)};
                                    const fechaGen = "${fechaStr}";

                                    const W = 1200;
                                    const PADDING = 40;
                                    const COL_WEIGHTS = [0.8, 1.6, 1.6, 2.0, 1.8, 3.0, 2.0, 2.0];
                                    const TOTAL_WEIGHT = COL_WEIGHTS.reduce((a,b)=>a+b, 0);
                                    const ANCHO_DISP = W - (PADDING * 2);
                                    const anchos = COL_WEIGHTS.map(w => (w / TOTAL_WEIGHT) * ANCHO_DISP);

                                    const C_AZUL = '#2C3E50';
                                    const C_ZEBRA = '#F5F5F5';
                                    const C_VERDE = '#27AE60';
                                    const C_ROJO = '#C0392B';
                                    const C_NEGRO = '#000000';
                                    const C_BLANCO = '#FFFFFF';

                                    function wrapText(context, text, x, y, maxWidth, lineHeight) {
                                        const words = text.split(' ');
                                        let line = '';
                                        let currentY = y;
                                        for(let n = 0; n < words.length; n++) {
                                            const testLine = line + words[n] + ' ';
                                            if (context.measureText(testLine).width > maxWidth && n > 0) {
                                                context.fillText(line, x, currentY);
                                                line = words[n] + ' ';
                                                currentY += lineHeight;
                                            } else {
                                                line = testLine;
                                            }
                                        }
                                        context.fillText(line, x, currentY);
                                        return currentY + lineHeight;
                                    }

                                    const fmtMoney = (val) => "DOP$ " + parseFloat(val).toFixed(2);
                                    ctx.font = '19px sans-serif';
                                    let H = 600;
                                    const alturasFilas = [];
                                    filas.forEach(f => {
                                        const anchoDesc = anchos[5] - 20;
                                        const words = (f.descripcion || '').split(' ');
                                        let line = '';
                                        let lineCount = 1;
                                        for(let n=0; n<words.length; n++){
                                            let testLine = line + words[n] + ' ';
                                            if(ctx.measureText(testLine).width > anchoDesc && n > 0){
                                                lineCount++;
                                                line = words[n] + ' ';
                                            } else { line = testLine; }
                                        }
                                        const alto = Math.max(50, (lineCount * 24) + 20);
                                        alturasFilas.push(alto);
                                        H += alto;
                                    });

                                    canvas.width = W;
                                    canvas.height = H;
                                    ctx.fillStyle = C_BLANCO;
                                    ctx.fillRect(0, 0, W, H);

                                    let currentY = PADDING + 40;
                                    ctx.fillStyle = C_AZUL;
                                    ctx.font = 'bold 36px sans-serif';
                                    ctx.textAlign = 'center';
                                    ctx.fillText("INFORME FINANCIERO - " + mesCuota, W/2, currentY);
                                    currentY += 60;

                                    const anchoCaja = (W - (PADDING * 2)) / 4;
                                    const cajas = [
                                        { title: 'TOTAL RECIBIDO', val: totalRecibido },
                                        { title: 'CUOTA', val: cuota },
                                        { title: 'MONTO A PAGAR', val: aPagar },
                                        { title: 'PENDIENTE', val: pendiente, isPendiente: true }
                                    ];

                                    let cX = PADDING;
                                    cajas.forEach(c => {
                                        ctx.fillStyle = C_AZUL;
                                        ctx.fillRect(cX + 5, currentY, anchoCaja - 10, 100);
                                        ctx.fillStyle = C_BLANCO;
                                        ctx.font = '18px sans-serif';
                                        ctx.textAlign = 'center';
                                        ctx.fillText(c.title, cX + anchoCaja/2, currentY + 35);
                                        ctx.font = 'bold 26px sans-serif';
                                        if(c.isPendiente && c.val > 0) ctx.fillStyle = '#ff6666';
                                        ctx.fillText(fmtMoney(c.val), cX + anchoCaja/2, currentY + 75);
                                        cX += anchoCaja;
                                    });
                                    currentY += 140;

                                    ctx.fillStyle = C_AZUL;
                                    ctx.fillRect(PADDING, currentY, W - (PADDING * 2), 60);
                                    ctx.fillStyle = C_BLANCO;
                                    ctx.font = 'bold 20px sans-serif';
                                    ctx.textAlign = 'center';
                                    const headers = ["Apto", "Propietario", "Estado", "Recibido", "Cuota", "Descripción", "A Pagar", "Balance"];

                                    let hX = PADDING;
                                    headers.forEach((h, i) => {
                                        ctx.fillText(h, hX + (anchos[i]/2), currentY + 38);
                                        hX += anchos[i];
                                    });
                                    currentY += 60;

                                    let isPar = false;
                                    filas.forEach((f, idx) => {
                                        const aFila = alturasFilas[idx];
                                        if(isPar) {
                                            ctx.fillStyle = C_ZEBRA;
                                            ctx.fillRect(PADDING, currentY, W - (PADDING * 2), aFila);
                                        }
                                        isPar = !isPar;

                                        let fX = PADDING;
                                        const yCentro = currentY + (aFila/2) + 6;
                                        const drawText = (txt, ancho, align, bold, color) => {
                                            ctx.fillStyle = color;
                                            ctx.font = (bold ? 'bold ' : '') + '19px sans-serif';
                                            ctx.textAlign = align;
                                            let px = align === 'center' ? fX + (ancho/2) : (align === 'right' ? fX + ancho - 10 : fX + 10);
                                            ctx.fillText(txt, px, yCentro);
                                            fX += ancho;
                                        };

                                        drawText(f.apto, anchos[0], 'center', true, C_NEGRO);
                                        drawText(f.propietario, anchos[1], 'left', false, C_NEGRO);
                                        const alDia = f.balance >= 0;
                                        drawText(alDia ? "AL DÍA" : "PENDIENTE", anchos[2], 'center', true, alDia ? C_VERDE : C_ROJO);
                                        drawText(fmtMoney(f.montoPagar), anchos[3], 'right', false, C_NEGRO);
                                        drawText(fmtMoney(f.cuotaMensual), anchos[4], 'right', false, C_NEGRO);

                                        ctx.fillStyle = C_NEGRO;
                                        ctx.font = '19px sans-serif';
                                        ctx.textAlign = 'left';
                                        wrapText(ctx, f.descripcion || '', fX + 10, currentY + 28, anchos[5] - 20, 24);
                                        fX += anchos[5];

                                        drawText(fmtMoney(f.montoPagar), anchos[6], 'right', true, C_NEGRO);
                                        drawText(fmtMoney(f.balance), anchos[7], 'right', true, f.balance < 0 ? C_ROJO : C_NEGRO);
                                        currentY += aFila;
                                    });

                                    currentY += 40;
                                    ctx.fillStyle = '#888888';
                                    ctx.font = '18px sans-serif';
                                    ctx.textAlign = 'left';
                                    ctx.fillText("Generado el: " + fechaGen + " | ResiFlow Administrativo", PADDING, currentY);

                                    const imgData = canvas.toDataURL("image/jpeg", 1.0);
                                    const link = document.createElement('a');
                                    link.download = "Informe_Financiero_" + mesCuota.replace(' ', '_') + ".jpg";
                                    link.href = imgData;
                                    link.click();
                                    document.querySelector('.loading').innerText = "¡Imagen JPG descargada con éxito!";
                                };
                            </script>
                        </body>
                    </html>
                `);
                win.document.close();
            }
        } else {
            try {
                const htmlResumen = construirHTMLInforme(false, false);
                const { uri } = await Print.printToFileAsync({ html: htmlResumen });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'application/pdf',
                        dialogTitle: `Informe Financiero - ${mesActualObj.mesAnio.toUpperCase()}`,
                    });
                } else {
                    ResiAlert.success('Informe Generado', `Archivo guardado en: ${uri}`);
                }
            } catch (error) {
                ResiAlert.error('Error', 'No se pudo generar el informe en este dispositivo.');
            }
        }
    };

    const descargarPDFContabilidad = async () => {
        if (!mesActualObj || !mesActualObj.filas) {
            ResiAlert.warning('Sin Datos', 'No hay registros cargados.');
            return;
        }

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const htmlWeb = construirHTMLInforme(true, true);
            const win = window.open('', '_blank');
            if (win) {
                win.document.write(htmlWeb);
                win.document.close();
            }
        } else {
            try {
                const htmlMovil = construirHTMLInforme(true, false);
                const { uri } = await Print.printToFileAsync({ html: htmlMovil });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'application/pdf',
                        dialogTitle: `PDF Contabilidad - ${mesActualObj.mesAnio.toUpperCase()}`,
                    });
                } else {
                    ResiAlert.success('PDF Generado', `Archivo guardado en: ${uri}`);
                }
            } catch (error) {
                ResiAlert.error('Error', 'No se pudo generar el documento PDF en el celular.');
            }
        }
    };

    const bottomSafeModal = Platform.OS === 'android' ? Math.max(insets.bottom + 20, 44) : Math.max(insets.bottom, 20);

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
            <Text style={[styles.sectionHeader, { color: colors.subText }]}>CONTROL CONTABLE Y FACTURACIÓN MENSUAL</Text>
            <View style={styles.topHeaderBar}>
                <View style={[styles.switchTabsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                        style={[styles.switchTabBtn, vistaActiva === 'CONTABILIDAD' && { backgroundColor: colors.primary }]}
                        onPress={() => setVistaActiva('CONTABILIDAD')}
                    >
                        <Feather name="layers" size={14} color={vistaActiva === 'CONTABILIDAD' ? '#FFFFFF' : colors.subText} />
                        <Text style={[styles.switchTabText, { color: vistaActiva === 'CONTABILIDAD' ? '#FFFFFF' : colors.subText }]}>
                            Mantenimiento
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.switchTabBtn, vistaActiva === 'GAS' && { backgroundColor: colors.primary }]}
                        onPress={() => setVistaActiva('GAS')}
                    >
                        <Feather name="activity" size={14} color={vistaActiva === 'GAS' ? '#FFFFFF' : colors.subText} />
                        <Text style={[styles.switchTabText, { color: vistaActiva === 'GAS' ? '#FFFFFF' : colors.subText }]}>
                            Gas GLP (m³)
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {cargando ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ color: colors.subText, marginTop: 10, fontSize: 13 }}>
                        Sincronizando registros financieros...
                    </Text>
                </View>
            ) : vistaActiva === 'CONTABILIDAD' ? (
                <View style={{ gap: 18 }}>
                    <View style={[styles.controlCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[styles.controlsRow, isDesktop && styles.controlsRowDesktop]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.inputLabel, { color: colors.text }]}>Periodo Contable (Mes-Año)</Text>
                                <View style={[styles.searchBarContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                    <TextInput
                                        style={[styles.searchInputDirect, { color: colors.text }]}
                                        value={busquedaMes}
                                        onChangeText={setBusquedaMes}
                                        placeholder="Escribe un mes-año..."
                                        placeholderTextColor={colors.subText}
                                    />
                                    {tieneMesEscrito && (
                                        <TouchableOpacity onPress={() => setBusquedaMes('')}>
                                            <Feather name="x-circle" size={16} color={colors.subText} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            <View style={styles.actionButtonsGroup}>
                                <TouchableOpacity
                                    style={[styles.btnPrimaryBlue, { backgroundColor: colors.primary }]}
                                    onPress={handleAccionPrincipal}
                                >
                                    <Feather name={tieneMesEscrito ? 'refresh-cw' : 'plus-circle'} size={15} color="#FFFFFF" />
                                    <Text style={styles.btnPrimaryText}>{tieneMesEscrito ? 'Actualizar' : 'Registrar'}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.btnSecondarySoft, { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }]}
                                    onPress={() => void descargarIMGContabilidad()}
                                >
                                    <Feather name="image" size={15} color="#2E7D32" />
                                    <Text style={[styles.btnSecondaryText, { color: '#2E7D32' }]}>IMG</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.btnSecondarySoft, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]}
                                    onPress={() => void descargarPDFContabilidad()}
                                >
                                    <Feather name="download" size={15} color={colors.primary} />
                                    <Text style={[styles.btnSecondaryText, { color: colors.primary }]}>PDF</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.monthPillsRow}>
                            {historialMeses.map((m) => {
                                const activo = tieneMesEscrito && m.mesAnio.toLowerCase() === mesActualObj?.mesAnio.toLowerCase();
                                return (
                                    <TouchableOpacity
                                        key={m.id ?? m.mesAnio}
                                        style={[
                                            styles.monthChip,
                                            { backgroundColor: colors.inputBg, borderColor: colors.border },
                                            activo && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                                        ]}
                                        onPress={() =>
                                            setBusquedaMes(busquedaMes.toLowerCase() === m.mesAnio.toLowerCase() ? '' : m.mesAnio)
                                        }
                                    >
                                        <Text
                                            style={[
                                                styles.monthChipText,
                                                { color: colors.subText },
                                                activo && { color: colors.primary, fontWeight: '800' },
                                            ]}
                                        >
                                            {m.mesAnio.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {mesActualObj && (
                        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={styles.tableCardTopHeader}>
                                <View>
                                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                                        Mes: {mesActualObj.mesAnio.toUpperCase()}
                                    </Text>
                                    <Text style={[styles.cardSubtitle, { color: colors.subText }]}>
                                        Desglose de cuotas y balance por apartamento
                                    </Text>
                                </View>
                                <View style={[styles.badgeInfo, { backgroundColor: colors.primarySoft }]}>
                                    <Text style={[styles.badgeInfoText, { color: colors.primary }]}>
                                        {mesActualObj.filas.length} Unidades
                                    </Text>
                                </View>
                            </View>

                            <View style={[styles.tableHeaderRow, { backgroundColor: colors.inputBg }]}>
                                <Text style={[styles.thText, { flex: 0.6, color: colors.subText }]}>APTO</Text>
                                <Text style={[styles.thText, { flex: 1.1, textAlign: 'right', color: colors.subText }]}>CUOTA</Text>
                                <Text style={[styles.thText, { flex: 1.4, paddingLeft: 10, color: colors.subText }]}>DESCRIPCION</Text>
                                <Text style={[styles.thText, { flex: 1.1, textAlign: 'right', color: colors.subText }]}>PAGAR</Text>
                                <Text style={[styles.thText, { flex: 1.4, textAlign: 'right', color: colors.subText }]}>BALANCE</Text>
                            </View>

                            {mesActualObj.filas.map((f, idx) => {
                                const esNegativo = f.balance < 0;
                                return (
                                    <View
                                        key={f.apto}
                                        style={[
                                            styles.tableDataRow,
                                            { borderBottomColor: colors.inputBg },
                                            idx % 2 === 1 && { backgroundColor: darkMode ? colors.inputBg : '#F8FAFC' },
                                        ]}
                                    >
                                        <View style={{ flex: 0.6 }}>
                                            <View style={[styles.aptoBadge, { backgroundColor: colors.primarySoft }]}>
                                                <Text style={[styles.aptoBadgeText, { color: colors.primary }]}>{f.apto}</Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.tdRight, { flex: 1.1, color: colors.text }]} numberOfLines={1}>
                                            RD$ {f.cuotaMensual.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                        </Text>
                                        <Text
                                            style={[styles.tdDesc, { flex: 1.4, paddingLeft: 10, color: colors.subText }]}
                                            numberOfLines={1}
                                            ellipsizeMode="tail"
                                        >
                                            {f.descripcion}
                                        </Text>
                                        <Text style={[styles.tdRight, { flex: 1.1, color: colors.text }]} numberOfLines={1}>
                                            RD$ {f.montoPagar.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                        </Text>
                                        <Text
                                            numberOfLines={1}
                                            style={[styles.tdRightBold, { flex: 1.4, color: esNegativo ? colors.danger : colors.success }]}
                                        >
                                            {f.balance >= 0 ? '+' : ''}RD${' '}
                                            {f.balance.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            ) : (
                <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {mensajeGasEnviado ? (
                        <View style={[styles.successBanner, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
                            <Text style={[styles.successText, { color: colors.success }]}>{mensajeGasEnviado}</Text>
                        </View>
                    ) : null}

                    <View style={styles.tableCardTopHeader}>
                        <View style={{ flex: 1, minWidth: 180 }}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Control de Gas GLP (m³)</Text>
                            <Text style={[styles.cardSubtitle, { color: colors.subText }]}>
                                Actualiza la lectura y presiona "+" para enviar cobro
                            </Text>
                        </View>
                        <View style={[styles.gasPriceBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                            <Text style={[styles.gasPriceLabel, { color: colors.text }]}>Precio m³ (RD$):</Text>
                            <TextInput
                                style={[
                                    styles.gasPriceInput,
                                    { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                                ]}
                                value={precioM3}
                                onChangeText={setPrecioM3}
                                keyboardType="decimal-pad"
                                selectTextOnFocus
                            />
                        </View>
                    </View>

                    <View style={[styles.tableHeaderRow, { backgroundColor: colors.inputBg }]}>
                        <Text style={[styles.thText, { flex: 0.55, color: colors.subText }]} numberOfLines={1}>APTO</Text>
                        <Text style={[styles.thText, { flex: 1.05, color: colors.subText }]} numberOfLines={1}>RESP.</Text>
                        <Text style={[styles.thText, { flex: 0.6, textAlign: 'center', color: colors.subText }]} numberOfLines={1}>ANT</Text>
                        <Text style={[styles.thText, { flex: 0.95, textAlign: 'center', color: colors.subText }]} numberOfLines={1}>ACT</Text>
                        <Text style={[styles.thText, { flex: 0.65, textAlign: 'right', color: colors.subText }]} numberOfLines={1}>CONS.</Text>
                        <Text style={[styles.thText, { flex: 0.85, textAlign: 'right', color: colors.subText }]} numberOfLines={1}>TOTAL</Text>
                        <Text style={[styles.thText, { flex: 0.65, textAlign: 'center', color: colors.subText }]} numberOfLines={1}>ENVIAR</Text>
                    </View>

                    {lecturasGas.map((g, idx) => {
                        const consumo = Math.max(0, (parseFloat(g.act) || 0) - g.ant);
                        const total = consumo * (parseFloat(precioM3) || 0);
                        const estaEnviando = enviandoGasApto === g.apto;

                        return (
                            <View
                                key={g.apto}
                                style={[
                                    styles.tableDataRow,
                                    { borderBottomColor: colors.inputBg },
                                    idx % 2 === 1 && { backgroundColor: darkMode ? colors.inputBg : '#F8FAFC' },
                                ]}
                            >
                                <View style={{ flex: 0.55 }}>
                                    <View style={[styles.aptoBadge, { backgroundColor: colors.primarySoft }]}>
                                        <Text style={[styles.aptoBadgeText, { color: colors.primary }]}>{g.apto}</Text>
                                    </View>
                                </View>
                                <View style={{ flex: 1.05 }}>
                                    <Text style={[styles.tdNameText, { color: colors.text }]} numberOfLines={1}>
                                        {g.responsable}
                                    </Text>
                                    <Text style={[styles.tdSubRole, { color: colors.subText }]} numberOfLines={1}>
                                        {g.pagador}
                                    </Text>
                                </View>
                                <Text style={[styles.tdCenter, { flex: 0.6, color: colors.text }]} numberOfLines={1}>
                                    {g.ant.toFixed(0)}
                                </Text>
                                <View style={{ flex: 0.95, alignItems: 'center' }}>
                                    <TextInput
                                        style={[
                                            styles.gasRowInput,
                                            { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                                            g.modificado && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                                        ]}
                                        value={g.act}
                                        keyboardType="decimal-pad"
                                        selectTextOnFocus
                                        onChangeText={(v) =>
                                            setLecturasGas((prev) =>
                                                prev.map((item, i) => (i === idx ? { ...item, act: v, modificado: true } : item))
                                            )
                                        }
                                    />
                                </View>
                                <Text style={[styles.tdRight, { flex: 0.65, color: colors.text }]} numberOfLines={1}>
                                    {consumo.toFixed(1)}
                                </Text>
                                <Text style={[styles.tdRightBold, { flex: 0.85, color: colors.text }]} numberOfLines={1}>
                                    {total.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                </Text>
                                <View style={{ flex: 0.65, alignItems: 'center' }}>
                                    <TouchableOpacity
                                        style={[
                                            styles.sendGasBtn,
                                            { backgroundColor: colors.success },
                                            g.modificado && { backgroundColor: colors.primary },
                                        ]}
                                        disabled={estaEnviando}
                                        onPress={() => void enviarCobroGasPropietario(g, idx, total)}
                                    >
                                        {estaEnviando ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <Feather name="plus" size={15} color="#FFFFFF" />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            <Modal
                visible={modalVisible}
                transparent
                statusBarTranslucent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View
                    style={[
                        styles.modalBackdrop,
                        {
                            backgroundColor: darkMode ? 'rgba(0,0,0,0.7)' : 'rgba(15, 23, 42, 0.5)',
                            paddingBottom: bottomSafeModal,
                        },
                    ]}
                >
                    <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <View style={styles.modalHeaderRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={[styles.iconSoftBlue, { backgroundColor: colors.primarySoft }]}>
                                        <Feather name={modoModal === 'ACTUALIZAR' ? 'edit-3' : 'file-plus'} size={18} color={colors.primary} />
                                    </View>
                                    <View>
                                        <Text style={[styles.modalTitle, { color: colors.text }]}>Registro Financiero</Text>
                                        <Text style={[styles.modalSubtitle, { color: colors.subText }]}>
                                            {modoModal === 'ACTUALIZAR' ? `Actualizando: ${cuotaDelMes.toUpperCase()}` : 'Registrar nueva cuota'}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <Feather name="x" size={20} color={colors.subText} />
                                </TouchableOpacity>
                            </View>

                            <View style={{ zIndex: 10, position: 'relative' }}>
                                <TouchableOpacity
                                    style={[
                                        styles.modalDropdownBox,
                                        { backgroundColor: colors.inputBg, borderColor: colors.border },
                                        dropdownAbierto && modoModal === 'REGISTRAR' && styles.modalDropdownBoxOpen,
                                        modoModal === 'ACTUALIZAR' && { backgroundColor: colors.inputBg },
                                    ]}
                                    onPress={() => setDropdownAbierto(!dropdownAbierto)}
                                    disabled={modoModal === 'ACTUALIZAR'}
                                >
                                    <Text
                                        style={[
                                            styles.modalDropdownText,
                                            { color: colors.text },
                                            (!cuotaDelMes || modoModal === 'ACTUALIZAR') && { color: colors.subText },
                                        ]}
                                    >
                                        {cuotaDelMes ? cuotaDelMes.toUpperCase() : 'Cuota del mes'}
                                    </Text>
                                    {modoModal === 'ACTUALIZAR' ? (
                                        <Feather name="lock" size={14} color={colors.subText} />
                                    ) : (
                                        <Ionicons name="caret-down" size={16} color={colors.subText} />
                                    )}
                                </TouchableOpacity>
                                {dropdownAbierto && modoModal === 'REGISTRAR' && (
                                    <View style={[styles.dropdownListContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                        <ScrollView nestedScrollEnabled={true}>
                                            {mesesDisponibles.length > 0 ? (
                                                mesesDisponibles.map((mes) => (
                                                    <TouchableOpacity
                                                        key={mes}
                                                        style={[styles.dropdownOptionItem, { borderBottomColor: colors.inputBg }]}
                                                        onPress={() => {
                                                            setCuotaDelMes(mes);
                                                            setDropdownAbierto(false);
                                                        }}
                                                    >
                                                        <Text style={[styles.dropdownOptionText, { color: colors.text }]}>
                                                            {mes.toUpperCase()}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))
                                            ) : (
                                                <Text style={[styles.emptyListText, { color: colors.subText }]}>
                                                    No hay meses pendientes
                                                </Text>
                                            )}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.modalHelperText, { color: colors.subText }]}>
                                {modoModal === 'ACTUALIZAR' ? 'El periodo no puede ser modificado' : 'Selecciona desde la lista'}
                            </Text>

                            <View style={[styles.modalInputContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.modalTextInput, { color: colors.text }]}
                                    placeholder="Monto de la cuota"
                                    placeholderTextColor={colors.subText}
                                    keyboardType="numeric"
                                    value={montoCuota}
                                    onChangeText={setMontoCuota}
                                />
                            </View>

                            <View style={styles.checkboxGrid}>
                                <TouchableOpacity style={styles.checkboxItem} onPress={() => setCheckAgua(!checkAgua)}>
                                    <View
                                        style={[
                                            styles.checkboxSquare,
                                            { backgroundColor: colors.inputBg, borderColor: colors.border },
                                            checkAgua && { backgroundColor: colors.primary, borderColor: colors.primary },
                                        ]}
                                    >
                                        {checkAgua && <Feather name="check" size={13} color="#FFFFFF" />}
                                    </View>
                                    <Text style={[styles.checkboxLabel, { color: colors.text }]}>Agua</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.checkboxItem} onPress={() => setCheckMant(!checkMant)}>
                                    <View
                                        style={[
                                            styles.checkboxSquare,
                                            { backgroundColor: colors.inputBg, borderColor: colors.border },
                                            checkMant && { backgroundColor: colors.primary, borderColor: colors.primary },
                                        ]}
                                    >
                                        {checkMant && <Feather name="check" size={13} color="#FFFFFF" />}
                                    </View>
                                    <Text style={[styles.checkboxLabel, { color: colors.text }]}>Mantenimiento</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.checkboxItem} onPress={() => setCheckLuz(!checkLuz)}>
                                    <View
                                        style={[
                                            styles.checkboxSquare,
                                            { backgroundColor: colors.inputBg, borderColor: colors.border },
                                            checkLuz && { backgroundColor: colors.primary, borderColor: colors.primary },
                                        ]}
                                    >
                                        {checkLuz && <Feather name="check" size={13} color="#FFFFFF" />}
                                    </View>
                                    <Text style={[styles.checkboxLabel, { color: colors.text }]}>Luz</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.checkboxItem} onPress={() => setCheckOtros(!checkOtros)}>
                                    <View
                                        style={[
                                            styles.checkboxSquare,
                                            { backgroundColor: colors.inputBg, borderColor: colors.border },
                                            checkOtros && { backgroundColor: colors.primary, borderColor: colors.primary },
                                        ]}
                                    >
                                        {checkOtros && <Feather name="check" size={13} color="#FFFFFF" />}
                                    </View>
                                    <Text style={[styles.checkboxLabel, { color: colors.text }]}>Otros</Text>
                                </TouchableOpacity>
                            </View>

                            {checkOtros && (
                                <View
                                    style={[
                                        styles.modalInputContainer,
                                        { marginBottom: 16, backgroundColor: colors.inputBg, borderColor: colors.border },
                                    ]}
                                >
                                    <TextInput
                                        style={[styles.modalTextInput, { color: colors.text }]}
                                        placeholder="Escribe el concepto adicional"
                                        placeholderTextColor={colors.subText}
                                        value={textoOtros}
                                        onChangeText={setTextoOtros}
                                    />
                                </View>
                            )}

                            <View style={[styles.modalInputContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.modalTextInput, { color: colors.text }]}
                                    placeholder="Monto final"
                                    placeholderTextColor={colors.subText}
                                    keyboardType="numeric"
                                    value={montoFinal}
                                    onChangeText={setMontoFinal}
                                />
                            </View>

                            <Text style={[styles.facturasTitle, { color: colors.text }]}>Facturas del Mes</Text>
                            <Text style={[styles.facturasSubtitle, { color: colors.subText }]}>Máx. 4 - PNG, JPEG</Text>

                            <TouchableOpacity
                                style={[styles.selectFilesBtn, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}
                                onPress={() => void seleccionarArchivosFacturas()}
                            >
                                <Feather name="image" size={16} color={colors.primary} />
                                <Text style={[styles.selectFilesBtnText, { color: colors.primary }]}>Seleccionar Archivos</Text>
                            </TouchableOpacity>

                            <View style={styles.previewSquaresRow}>
                                {facturasUris.map((uri, idx) => (
                                    <View
                                        key={idx}
                                        style={[styles.previewSquare, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                                    >
                                        {uri ? (
                                            <>
                                                <Image
                                                    source={{ uri }}
                                                    style={{ width: '100%', height: '100%', borderRadius: 8 }}
                                                    resizeMode="cover"
                                                />
                                                <TouchableOpacity
                                                    style={[styles.deleteImageBtn, { backgroundColor: colors.danger }]}
                                                    onPress={() => eliminarImagenFactura(idx)}
                                                >
                                                    <Feather name="x" size={12} color="#FFFFFF" />
                                                </TouchableOpacity>
                                            </>
                                        ) : (
                                            <TouchableOpacity
                                                style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                                                onPress={() => void seleccionarArchivosFacturas()}
                                            >
                                                <Feather name="plus" size={18} color={colors.subText} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                            </View>

                            <View style={styles.modalBottomButtonsRow}>
                                <TouchableOpacity
                                    style={[styles.modalSaveBtn, { backgroundColor: colors.primary }, guardandoModal && { opacity: 0.7 }]}
                                    onPress={() => void guardarRegistroModal()}
                                    disabled={guardandoModal}
                                >
                                    <Text style={styles.modalSaveBtnText}>
                                        {guardandoModal ? 'Guardando...' : 'Guardar Registro'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalCancelBtn, { backgroundColor: colors.inputBg }]}
                                    onPress={() => setModalVisible(false)}
                                >
                                    <Text style={[styles.modalCancelBtnText, { color: colors.text }]}>Cancelar</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 14, paddingBottom: 48 },
    sectionHeader: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
    topHeaderBar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 },
    iconSoftBlue: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    switchTabsRow: { flexDirection: 'row', padding: 4, borderRadius: 12, borderWidth: 1, gap: 4 },
    switchTabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9 },
    switchTabText: { fontSize: 11, fontWeight: '700' },
    controlCard: { borderRadius: 16, padding: 14, borderWidth: 1 },
    controlsRow: { gap: 10 },
    controlsRowDesktop: { flexDirection: 'row', alignItems: 'flex-end' },
    inputLabel: { fontSize: 11, fontWeight: '700', marginBottom: 5 },
    searchBarContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, height: 38, paddingHorizontal: 10, gap: 6 },
    searchInputDirect: { flex: 1, height: '100%', fontSize: 12, paddingVertical: 0, includeFontPadding: false, outlineStyle: 'none' } as any,
    actionButtonsGroup: { flexDirection: 'row', gap: 8 },
    btnPrimaryBlue: { height: 38, paddingHorizontal: 14, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
    btnPrimaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
    btnSecondarySoft: { borderWidth: 1, height: 38, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    btnSecondaryText: { fontSize: 11, fontWeight: '700' },
    monthPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    monthChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    monthChipText: { fontSize: 10, fontWeight: '700' },
    tableCard: { borderRadius: 16, padding: 14, borderWidth: 1 },
    successBanner: { borderWidth: 1, padding: 8, borderRadius: 8, marginBottom: 10 },
    successText: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
    tableCardTopHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 },
    cardTitle: { fontSize: 15, fontWeight: '800' },
    cardSubtitle: { fontSize: 11, marginTop: 1 },
    badgeInfo: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    badgeInfoText: { fontSize: 10, fontWeight: '800' },
    tableHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 6, marginBottom: 2 },
    thText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.2 },
    tableDataRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1, borderRadius: 6 },
    aptoBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    aptoBadgeText: { fontSize: 10, fontWeight: '800' },
    tdNameText: { fontSize: 11, fontWeight: '700' },
    tdSubRole: { fontSize: 8.5, fontWeight: '700', marginTop: 1 },
    tdDesc: { fontSize: 11 },
    tdCenter: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
    tdRight: { fontSize: 11, fontWeight: '600', textAlign: 'right' },
    tdRightBold: { fontSize: 11, fontWeight: '800', textAlign: 'right' },
    gasPriceBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
    gasPriceLabel: { fontSize: 12, fontWeight: '800' },
    // CORREGIDO PARA ANDROID: Altura 36, paddingVertical 0 e includeFontPadding false
    gasPriceInput: {
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 0,
        height: 36,
        minWidth: 74,
        fontSize: 13,
        fontWeight: '800',
        textAlign: 'center',
        textAlignVertical: 'center',
        includeFontPadding: false,
        outlineStyle: 'none',
    } as any,
    gasRowInput: {
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 4,
        paddingVertical: 0,
        height: 36,
        width: 54,
        fontSize: 13,
        fontWeight: '800',
        textAlign: 'center',
        textAlignVertical: 'center',
        includeFontPadding: false,
        outlineStyle: 'none',
    } as any,
    sendGasBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14 },
    modalCard: { width: '100%', maxWidth: 460, maxHeight: '90%', borderRadius: 18, padding: 18, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    modalTitle: { fontSize: 16, fontWeight: '800' },
    modalSubtitle: { fontSize: 11, marginTop: 1 },
    modalDropdownBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 10, height: 40, paddingHorizontal: 12 },
    modalDropdownBoxOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
    modalDropdownText: { fontSize: 13, fontWeight: '600' },
    modalHelperText: { fontSize: 10, marginTop: 3, marginLeft: 2, marginBottom: 10 },
    dropdownListContainer: { borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, overflow: 'hidden', maxHeight: 160, marginBottom: 10 },
    dropdownOptionItem: { padding: 8, paddingHorizontal: 12, borderBottomWidth: 1 },
    dropdownOptionText: { fontSize: 12, fontWeight: '700' },
    emptyListText: { padding: 12, textAlign: 'center', fontSize: 11, fontStyle: 'italic' },
    modalInputContainer: { borderWidth: 1, borderRadius: 8, height: 42, justifyContent: 'center', paddingHorizontal: 12, marginBottom: 12 },
    modalTextInput: { width: '100%', height: '100%', fontSize: 13, paddingVertical: 0, includeFontPadding: false, textAlignVertical: 'center', outlineStyle: 'none' } as any,
    checkboxGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, marginBottom: 12 },
    checkboxItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6 },
    checkboxSquare: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    checkboxLabel: { fontSize: 11, fontWeight: '700' },
    facturasTitle: { fontSize: 13, fontWeight: '800' },
    facturasSubtitle: { fontSize: 10, marginTop: 1, marginBottom: 8 },
    selectFilesBtn: { borderWidth: 1, height: 36, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 },
    selectFilesBtnText: { fontSize: 12, fontWeight: '700' },
    previewSquaresRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    previewSquare: { flex: 1, aspectRatio: 1, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
    deleteImageBtn: { position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    modalBottomButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalSaveBtn: { flex: 1, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    modalSaveBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
    modalCancelBtn: { flex: 1, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    modalCancelBtnText: { fontSize: 12, fontWeight: '700' },
});