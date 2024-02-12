let arrayOfModels = []
var selected = null;

function pickModelFromMenu(name, bufferInfosAndVAOs){

    let index = null;
    selected = null;

    bufferInfosAndVAOs.forEach((object, i) => {
        if (object.hasOwnProperty('name')) {
            if (object['name'] === name) {
                arrayOfModels.push(object);
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
            li.textContent = `ID: ${item.id}, ${item.name}`;
            li.style.cursor = 'pointer';

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Excluir';
            deleteButton.onclick = function() {

                const index = items.findIndex(i => i.id === item.id);
                if (index !== -1) {
                    items.splice(index, 1);
                    updateItems(items);
                }
            };

            li.appendChild(deleteButton);
            ul.appendChild(li);
        }
    });

    list.appendChild(ul);
}

function updateListeners(){
    const lis = document.querySelectorAll('#crudItems > ul > li');

    lis.forEach(li => {

        li.addEventListener('click', () => {

            lis.forEach(item => {
                item.style.color = 'black';
                item.style.backgroundColor = 'white';
            });

            li.style.backgroundColor = 'blue';
            li.style.color = 'white';
            const id = li.textContent.split(',')[0].split(':')[1];
            updateSelected(id)
        });
    });
}

function updateSelected(id){
    selected = id;
    console.log(selected);
}
