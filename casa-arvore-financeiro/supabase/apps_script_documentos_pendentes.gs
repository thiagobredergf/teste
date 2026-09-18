/**
 * BPO Financeiro — captura de documentos pendentes (NF/boleto) por e-mail.
 *
 * Roda dentro da própria conta Gmail (log.aragutti@gmail.com), de graça,
 * sem depender de nenhum app externo. Busca e-mail não lido com anexo
 * pequeno, sobe o anexo pra pasta do Drive, marca como processado (label)
 * e manda um resumo por e-mail pra você mesmo.
 *
 * COMO INSTALAR (5 min, uma vez só):
 * 1. Abra https://script.google.com/ (logado com log.aragutti@gmail.com)
 * 2. "Novo projeto"
 * 3. Apague o conteúdo padrão e cole este arquivo inteiro
 * 4. Salve (nome sugerido: "BPO Financeiro - Documentos Pendentes")
 * 5. No menu esquerdo, clique no relógio ("Acionadores" / "Triggers")
 * 6. "+ Adicionar acionador":
 *    - Função a ser executada: checarDocumentosPendentes
 *    - Origem do evento: Baseado em tempo
 *    - Tipo: Temporizador por hora → a cada hora
 * 7. Salvar — vai pedir autorização (é sua própria conta, aceite)
 * 8. Pronto. Roda sozinho de hora em hora, sem precisar de mim nem de
 *    nenhum conector pago.
 *
 * Pra testar na hora, sem esperar o acionador: abra este arquivo no
 * script.google.com e clique em "Executar" (▶) uma vez.
 */

var DRIVE_FOLDER_ID = "1tQbtDMCzeEt0FjfY_tArz_tc0r9NH3Rd"; // pasta "BPO Financeiro - Pendências"
var LABEL_NAME = "BPO/Processado";
var NOTIFY_EMAIL = "log.aragutti@gmail.com";
var MAX_THREADS_PER_RUN = 20;
var MAX_ATTACHMENT_MB = 15;

function checarDocumentosPendentes() {
  var label = GmailApp.getUserLabelByName(LABEL_NAME) || GmailApp.createLabel(LABEL_NAME);
  var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);

  var threads = GmailApp.search(
    "is:unread has:attachment -label:" + LABEL_NAME.replace("/", "-"),
    0,
    MAX_THREADS_PER_RUN
  );

  var arquivados = []; // {remetente, assunto, arquivo, link}
  var pulados = []; // anexo grande demais

  threads.forEach(function (thread) {
    var messages = thread.getMessages();
    messages.forEach(function (message) {
      if (!message.isUnread()) return;

      var attachments = message.getAttachments({ includeInlineImages: false, includeAttachments: true });
      var relevantes = attachments.filter(function (att) {
        var tipo = att.getContentType();
        var nome = att.getName().toLowerCase();
        // ignora assinatura/ícone embutido comum
        if (nome.indexOf("image00") === 0 && att.getSize() < 20000) return false;
        return true;
      });

      relevantes.forEach(function (att) {
        var tamanhoMB = att.getSize() / (1024 * 1024);
        if (tamanhoMB > MAX_ATTACHMENT_MB) {
          pulados.push({ remetente: message.getFrom(), assunto: message.getSubject(), motivo: "anexo de " + tamanhoMB.toFixed(1) + "MB, acima do limite" });
          return;
        }
        var dataStr = Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), "yyyy-MM-dd");
        var remetente = message.getFrom().replace(/[<>]/g, "").replace(/[^a-zA-Z0-9@._ -]/g, "");
        var nomeArquivo = dataStr + " - " + remetente + " - " + att.getName();
        var file = folder.createFile(att.copyBlob().setName(nomeArquivo));
        arquivados.push({
          remetente: message.getFrom(),
          assunto: message.getSubject(),
          arquivo: nomeArquivo,
          link: file.getUrl(),
        });
      });

      thread.addLabel(label);
      message.markRead();
    });
  });

  if (arquivados.length > 0 || pulados.length > 0) {
    var corpo = "";
    if (arquivados.length > 0) {
      corpo += arquivados.length + " documento(s) arquivado(s) em " + folder.getUrl() + ":\n\n";
      arquivados.forEach(function (a) {
        corpo += "- " + a.arquivo + " (de: " + a.remetente + " — assunto: " + a.assunto + ")\n  " + a.link + "\n";
      });
    }
    if (pulados.length > 0) {
      corpo += "\n" + pulados.length + " anexo(s) pulado(s) por serem grandes demais (confira manualmente):\n\n";
      pulados.forEach(function (p) {
        corpo += "- de: " + p.remetente + " — assunto: " + p.assunto + " (" + p.motivo + ")\n";
      });
    }
    MailApp.sendEmail(NOTIFY_EMAIL, "BPO Financeiro — documentos pendentes processados", corpo);
  }
}
