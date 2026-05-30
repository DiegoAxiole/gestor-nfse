import * as forge from "node-forge";

export interface CertData {
  razao: string;
  cnpj: string;
  validade: string;
}

export function extractCertData(file: File, password: string): Promise<CertData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const bytes = new Uint8Array(reader.result as ArrayBuffer);
        const p12Der = forge.util.createBuffer(bytes);
        let p12Asn1: forge.asn1.Asn1;
        try {
          p12Asn1 = forge.asn1.fromDer(p12Der);
        } catch {
          reject(new Error("Arquivo .pfx inválido ou corrompido"));
          return;
        }
        let p12: forge.pkcs12.Pkcs12Pfx;
        try {
          p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
        } catch {
          reject(new Error("Senha do certificado incorreta"));
          return;
        }
        const certBag = p12.getBags({ bagType: forge.pki.oids.certBag });
        const certs = certBag[forge.pki.oids.certBag];
        if (!certs || certs.length === 0) {
          reject(new Error("Nenhum certificado encontrado no arquivo .pfx"));
          return;
        }
        const cert = certs[0].cert;
        console.log("[cert-extractor] subject attributes:", cert.subject.attributes);
        let razao = "";
        let cnpj = "";
        for (const attr of cert.subject.attributes) {
          const val = attr.value ? String(attr.value).trim() : "";
          console.log(`[cert-extractor] attr name="${attr.name}" type="${attr.type}" value="${val}"`);
          if (!razao && (attr.name === "commonName" || attr.name === "CN") && val) {
            razao = val.toUpperCase();
          }
          if (!cnpj && val) {
            const m = val.match(/RFB(\d{14})/);
            if (m) cnpj = m[1];
          }
          if (!cnpj && val) {
            const m = val.match(/(\d{14})/);
            if (m) cnpj = m[1];
          }
        }
        if (!razao) {
          reject(new Error("Não foi possível extrair a Razão Social do certificado"));
          return;
        }
        const expireStr = cert.validity.notAfter instanceof Date
          ? cert.validity.notAfter.toISOString()
          : String(cert.validity.notAfter);
        resolve({ razao, cnpj, validade: expireStr });
      } catch (err: any) {
        reject(new Error(err.message || "Erro ao processar certificado"));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
    reader.readAsArrayBuffer(file);
  });
}
