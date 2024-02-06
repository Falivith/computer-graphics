import os
import subprocess

# Caminho para o assimp2json.exe
assimp2json_path = r'C:\Users\faliv\Downloads\assimp2json-2.0-win32\Release\assimp2json.exe'

# Caminho para o diretório contendo os arquivos FBX
input_dir = r'C:\Users\faliv\Desktop\computer-graphics-\Trabalho_01\assets\KayKit_City_Builder_Bits_1.0_FREE\KayKit_City_Builder_Bits_1.0_FREE\Assets\fbx'

# Caminho para o diretório de saída JSON
output_dir = r'C:\Users\faliv\Desktop\computer-graphics-\Trabalho_01\assets\json'

# Verifique se o diretório de saída existe, se não, crie-o
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Iterar sobre os arquivos no diretório de entrada
for filename in os.listdir(input_dir):
    if filename.endswith(".fbx"):
        input_path = os.path.join(input_dir, filename)

        # Crie o nome do arquivo de saída alterando a extensão para .json
        output_filename = os.path.splitext(filename)[0] + '.json'
        output_path = os.path.join(output_dir, output_filename)

        # Comando para chamar o assimp2json.exe
        command = [
            assimp2json_path,
            input_path,
            output_path
        ]

        # Execute o comando usando subprocess
        subprocess.run(command, capture_output=True, text=True)

        print(f"Conversão concluída: {filename} -> {output_filename}")
