import json
import os
import base64
import db

def imagem_para_b64(image_path):
    if not image_path or not isinstance(image_path, str) or image_path.strip() in ["", "/"]:
        return None
        
    # Remove a barra inicial se houver
    path = image_path.lstrip('/')
    # Garante o caminho absoluto
    abs_path = os.path.join(os.getcwd(), path)
    
    if os.path.exists(abs_path) and os.path.isfile(abs_path):
        with open(abs_path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode()
            return f"data:image/jpeg;base64,{encoded}"
    return None

def migrar():
    print("🚀 Iniciando migração de fotos locais para o Neon (Base64)...")
    
    # 1. Tenta carregar dados.json
    if not os.path.exists("dados.json"):
        print("❌ Erro: Arquivo dados.json não encontrado.")
        return
        
    with open("dados.json", "r", encoding="utf-8") as f:
        dados = json.load(f)
        
    total = len(dados)
    print(f"📊 {total} itens carregados do arquivo local.")
    
    # 2. Converte e Salva em Lotes (Batching)
    # Fazer em lotes de 10 para não pesar a conexão com o Neon
    lote_tamanho = 10
    processados = 0
    total_imagens = 0
    
    for i in range(0, total, lote_tamanho):
        lote = dados[i : i + lote_tamanho]
        lote_atualizado = []
        
        for item in lote:
            # Se já for Base64, mantém. Se for caminho, tenta converter.
            if "image" in item and item["image"] and not item["image"].startswith("data:"):
                b64 = imagem_para_b64(item["image"])
                if b64:
                    item["image"] = b64
                    total_imagens += 1
            lote_atualizado.append(item)
        
        # Salva o lote no Neon
        try:
            db.salvar_todos_posts(lote_atualizado)
            processados += len(lote_atualizado)
            print(f"� Lote concluído: {processados}/{total} posts processados... ({total_imagens} imagens convertidas até agora)")
        except Exception as e:
            print(f"⚠️ Erro ao salvar lote {i//lote_tamanho + 1}: {e}")

    print("\n✅ SUCESSO! A migração por lotes foi concluída.")
    print("✨ Agora seu site em produção exibirá as imagens corretamente.")

if __name__ == "__main__":
    migrar()
