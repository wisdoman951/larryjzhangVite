import os

def list_files_to_txt(output_file='all_files.txt'):
    current_dir = os.getcwd()
    with open(output_file, 'w', encoding='utf-8') as f:
        for root, dirs, files in os.walk(current_dir):
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), start=current_dir)
                f.write(rel_path + '\n')
    print(f'檔案路徑已輸出到：{output_file}')

if __name__ == '__main__':
    list_files_to_txt()
