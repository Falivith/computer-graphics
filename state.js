let arrayOfModels = []
var selected = null;

function pickModelFromMenu(name, bufferInfosAndVAOs){

    let index = null;
    selected = null;

    bufferInfosAndVAOs.forEach((object, i) => {
        if (object.hasOwnProperty('name')) {
            if (object['name'] === name) {
                index = i;
            }
        }
    });

    return {
        arrayOfModels,
        index
    };
}

function updateItems(items){
    const list = document.getElementById('crudItems');
    list.innerHTML = '';

    const ul = document.createElement('ul');

    items.forEach(item => {
        if(item.hasOwnProperty('id')) {
            const li = document.createElement('li');
            li.style.cursor = 'pointer';

            const spanContainer = document.createElement('div');
            spanContainer.className = 'spanContainer';

            const textSpan = document.createElement('span');
            textSpan.textContent = `ID: ${item.id}, ${item.name}`;
            textSpan.className = 'textSpan';
            
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.className = 'deleteButton';
            deleteButton.onclick = function() {
                const index = items.findIndex(i => i.id === item.id);
                if (index !== -1) {
                    items.splice(index, 1);
                    updateItems(items);
                }
            };

            spanContainer.appendChild(textSpan);

            li.appendChild(spanContainer);
            li.appendChild(deleteButton);
            ul.appendChild(li);
        }
    });
    list.appendChild(ul);
    updateListeners();
}

function updateListeners(){
    const lis = document.querySelectorAll('#crudItems > ul > li');

    lis.forEach(li => {

        li.addEventListener('click', () => {

            lis.forEach(item => {
                item.style.color = 'black';
                item.style.backgroundColor = 'white';
            });

            li.style.backgroundColor = '#a5e0eb';
            li.style.color = 'black';
            const id = li.textContent.split(',')[0].split(':')[1];
            updateSelected(id)
        });
    });
}

function updateSelected(id){
    selected = id;
}

function convertToJSON(arrayOfObjects) {
    if (!Array.isArray(arrayOfObjects)) {
        throw new Error('A entrada deve ser um array');
    }

    const jsonString = JSON.stringify(arrayOfObjects);

    return jsonString;
}

function handleFile(file, callback) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const content = event.target.result;
        const importedItems = JSON.parse(content);
        callback(importedItems);
    };
    reader.readAsText(file);
}

document.getElementById('importScene').addEventListener('click', function() {
    document.getElementById('fileChooser').click();
});


function importState(importedItems, bufferInfosAndVAOs, oldItems) {

    const viewElem = document.getElementById("sceneView");

    importedItems.forEach(importedItem => {
        const name = importedItem.name;
        const index = bufferInfosAndVAOs.findIndex(obj => obj.name === name);
        if (index !== -1) {
            const matchedObject = bufferInfosAndVAOs[index];

            console.log('Correspondência encontrada:', matchedObject);

            oldItems.push({
                id: importedItem.id,
                name: bufferInfosAndVAOs[index].name,
                bufferInfo: bufferInfosAndVAOs[index].bufferInfo,
                vao: bufferInfosAndVAOs[index].vao,
                color: [0.1, 0.1, 0.3, 0.1],
                material: bufferInfosAndVAOs[index].material,
                element: viewElem,
                geometries: bufferInfosAndVAOs[index].geometries,
                focused: true,
                translation: importedItem.translation,
                rotation: importedItem.rotation,
                scale: importedItem.scale,
              });

        } else {
            console.warn(`Nenhuma correspondência encontrada para o item com o nome "${name}"`);
        }
    });

    updateItems(oldItems);
    updateListeners();
}
