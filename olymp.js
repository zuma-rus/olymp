open_olymp_site();

var w = window.document;

// стартовые значения (настройки)
var profit = 4567;      // огранчение на прибыль
var loose_bet = 10000;   // максимальная ставка (ограничение на слив)
var koefic = 0.35;       // коэффициент увеличения ставки по мартингейлу 4
var start_bet = 35;     // начальная ставка (исходя из которой далее будет увеличение)
var duration = 1;       // длительность сделки (в минутах) начальная (ибо в процессе увеличивается)
var bot_folder = 'c:\\bots\\olymp\\';    // рабочая папка
var step_replacement_trend = 3;  // шаг выше (или =) которого (при выигрыше) нет смены направления
var number_strategy = 1;    // стратегия ставок
                            // 1 - мартингейл-4
                            // 2 - дональда-натансона

// далее лучше не трогать
var balance = get_balance();
var profit_balance = balance + profit;
var start_duration = duration;  // изначальная ставка (типа константа)
var step = 1;                   // шаг игры (при мартингейле дублирует step_trend)
var step_trend = 1;             // шаг тренда (учавствует в поворотах тренда)
var max_step = 1;               // учавствует в статистике (записывается в лог)
var start_balance = balance;    // учавствует в статистике (для подсчёта профита и показа на дисплее)
var count_win = 0;              // счётчик выигрышей
var count_loose = 0;            // счётчик проигрышей
var volume_bets = 0;            // объём ставок
var trend = 'start';            // стартовое значение направления. Просто обозначено здесь.
var session_file_name = bot_folder + 'session_' + get_date() + '_' + get_hours() + '.txt';

// ================================== Вспомогательные функции ===============================

// функция, чтобы работала кнопка стоп
function iimPlayCode(code) {

    var Cc = Components.classes,
        Ci = Components.interfaces,
        wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                .getService(Ci.nsIWindowMediator)
                .getMostRecentWindow("navigator:browser");

    iimPlay('CODE:' + code);

    if (iimGetLastError() == 'Macro stopped manually') {
            log('Скрипт остановлен кнопкой стоп! Баланс:' + String(balance) +
                ' макс.шаг:' + String(max_step) + '\n');
            window.setTimeout(function() {
                wm.iMacros.panel.sidebar.
                document.getElementById('message-box-button-close').click()
            } , 4);
            throw 'Скрипт остановлен кнопкой стоп!';
    }
};

// функции (ЧТЕНИЯ / ЗАПИСИ / ДОБАВЛЕНИЕ В КОНЕЦ) файла
function readFromFile(filename){return imns.FIO.readTextFile(imns.FIO.openNode(filename))}
function writeToFile(filename, cont){imns.FIO.writeTextFile(imns.FIO.openNode(filename),cont)}
function appendToFile(filename,cont){imns.FIO.appendTextFile(imns.FIO.openNode(filename),cont)}

// проверка на существование файла (задавать с полным путём)
function file_exists(file_name){
    try{
        result = true;
        e = readFromFile(file_name);
    } catch(e) {
        result = false;
    } finally {
        return result;
    }
}

// ожидание
function wait(s) {iimPlayCode("WAIT SECONDS=" + s);}

// добавляет впереди ноль, если число меньше десяти
function nulTen (txt) { return (Number(txt) < 10) ? '0' + txt : txt; }

// получить дату
function get_date() {
    var d=new Date();
    return d.getFullYear() + "-" + nulTen(d.getMonth()) + "-" + nulTen(d.getDate());
}

// получить вчерашнюю дату
function get_yesterday() {
    var d=new Date();
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + "-" + nulTen(d.getMonth()) + "-" + nulTen(d.getDate());
}

// получение времени
function get_current_time(){
    var d=new Date();
    return nulTen(d.getHours()) + ":" + nulTen(d.getMinutes()) + ":" + nulTen(d.getSeconds());
}

// который час (именно час)
function get_hours(){
    var d=new Date();
    return d.getHours();
}

// переход на верх страницы
function click_to_top() {
    window.scrollTo(0,0);
}


// ================================== Функции для олимпа ===============================

// запись лога в файл
function log(txt) { appendToFile(bot_folder + 'log.txt', get_current_time() + ' | ' + txt + '\n'); }

// сохранение лог файла в папку logs и создание нового log.txt
function update_log_file() {
    old_log = readFromFile(bot_folder + 'log.txt');
    yesterday = get_yesterday();
    yesterday_file_log = bot_folder + 'logs\\' + yesterday + '_log.txt';

    if (!file_exists(yesterday_file_log)){
        writeToFile(yesterday_file_log , old_log);
        writeToFile(bot_folder + 'log.txt', '');
    }
}

// файл сессии
function save_session_file(txt) {
    appendToFile(session_file_name, txt + '\n');
}

// получение баланса
function get_balance() {
    var b = w.getElementsByClassName("sum header-row__balance-sum ")[0].textContent;
    num = '';
    for (i = 0, l = b.length; i < l; i++) {
        bk = parseInt(b[i]);
        if (isNaN(bk) && b[i]!=',') continue;
        num += b[i];
    }
    num = parseFloat(num.replace(',','.'));
    return num;
}

// стартовое направление (направление входа)
function get_start_trend() {
    // upText
    indicator = parseInt(w.getElementsByClassName("sentiment--text sentiment--text__up")[0].textContent.replace('%',''));
    if (indicator <= 50) {  // стартуем всегда по тренду
        return 'up';
    } else { return 'down'; }
}

// смена направления ставки
function change_trend(trend) {
    if (trend == 'up') return 'down';
    else return 'up';
}

// получить процент валютной пары
function get_percent_currency() {
    return parseInt(w.getElementsByClassName("income__perc")[0].textContent.replace('%',''));
}

// установить длительность сделки (в минутах)
function set_duration_transaction(minutes) {

    old_duration = parseInt(w.querySelector('input[type="text"][class="timeinput__input timeinput__input_minutes"]').value);

    if (old_duration != minutes){
        iimPlayCode("TAG POS=2 TYPE=SPAN ATTR=TXT:мин." + '\n' +
                    "TAG POS=2 TYPE=INPUT:TEXT ATTR=* CONTENT=" + minutes);
    }
    return minutes;
}

// узнать длительность сделки (в зависимости от шага)
function new_duration(step) {
    if (number_strategy == 1){
        switch (step)
        {
            case 1:
            case 2:
                return set_duration_transaction(start_duration * 1);
                break;
            case 3:
                return set_duration_transaction(start_duration * 2);
                break;
            case 4:
                return set_duration_transaction(start_duration * 3);
                break;
            case 5:
                return set_duration_transaction(start_duration * 5);
                break;
            case 6:
                return set_duration_transaction(start_duration * 2);
                break;
            case 7:
                return set_duration_transaction(start_duration * 6);
                break;
            default:
                return set_duration_transaction(start_duration * 10);
                break;
        }
    } else if (number_strategy == 2) {
        switch (step)
        {
            case 1:
            case 2:
                return set_duration_transaction(start_duration * 1);
                break;
            case 3:
            case 4:
            case 5:
                return set_duration_transaction(start_duration * 2);
                break;
            case 6:
            case 7:
            case 8:
                return set_duration_transaction(start_duration * 3);
                break;
            case 9:
            case 10:
            case 11:
            case 12:
                return set_duration_transaction(start_duration * 4);
                break;
            default:
                return set_duration_transaction(start_duration * 5);
                break;
        }
    }
}

// установить ставку
function set_bet(bet) {
    // w.querySelector('input[data-test="deal-amount-input"]').value = String(bet);
    // w.querySelector('span[class="input-currency__value"]').innerHTML = String(bet);
    iimPlayCode("TAG POS=3 TYPE=INPUT:TEXT ATTR=* CONTENT=" + bet);
}

// нажать кнопку "выше"
function click_up() {
    w.querySelector('button[data-test="deal-button-up"]').click();
}

// нажать кнопку "ниже"
function click_down() {
    w.querySelector('button[data-test="deal-button-down"]').click();
}

// получить id последней завершённой сделки
function get_latest_id() {
    var tbl = w.getElementsByClassName("user-deals-table__body")[0];
    id = tbl.childNodes[0].childNodes[5].textContent;
    return id;
}

// проверка выигрыша
function check_win_loose(real_id) {
    // каждая итерация цикла = 1/5 секунды. Итого цикл идёт 20 секунд (+15 сек REFRESH)
    for(i = 0; i < 20; i++){
        try{
            var tbl = w.getElementsByClassName("user-deals-table__body")[0];
            forecast = tbl.childNodes[0].childNodes[8].textContent;
            tbl_id = tbl.childNodes[0].childNodes[5].textContent;
        } catch(e) {
            tbl_id = false;
        }
        if (i == 10) {
            iimPlayCode('REFRESH\nWAIT SECONDS=#DOWNLOADCOMPLETE#');
            log('Возможно что-то подзависло. Обновили страницу.');
            wait(15);
            w = window.document;
            continue;
        }

        // проверка, а поменялась ли таблица и верную ли строчку мы парсим
        // и если не верную, то делаем микро-задержку и запускаем рекурсивно повтор
        if (tbl_id != real_id) {
            wait(0.2 * i);
            continue;
        }

        if (forecast == 'Прогноз не оправдался') result = false;
        else if (forecast == 'Возврат') result = 'Возврат';
        else if (forecast == 'Прогноз оправдался') result = true;
        else { wait(0.2 * i); continue; }
        return result;
    }
    if (search_trade_transaction()) return 'Возврат'; // если нет сделок, то перезапуск
    return 'ERROR';
}

// одна итерация
function one_roll(bet, duration, trend) {

    // если только есть надпись, что ставок нет
    if (search_trade_transaction()){

        set_bet(bet);
        if (trend == 'up') { click_up(); }
        else { click_down(); }

        volume_bets = volume_bets + bet;

        click_to_top(); // прокрутка вверх

        wait(3); // первая часть времени
    } else {
        iimDisplay ('Какая-то путаница со ставками. Включен режим ожидания.');
        wait(duration);
        return one_roll(bet, duration, trend); // перезапуск
    }

    // если ставка не сработала или был зависон какой-то или ещё какая-то фигня и таймер не тикает
    if (timer_not_found()) {
        msg = 'Таймер не тикает. Ошибка или зависон. Обновляем страницу и пробуем ещё раз запустить сделку.';
        log(msg);
        iimDisplay(msg);
        iimPlayCode('REFRESH\nWAIT SECONDS=#DOWNLOADCOMPLETE#');
        wait(10);
        w = window.document;
        result = one_roll(bet, duration, trend);
        return result;
    }

    dsp(bet, trend);
    current_id = get_latest_id(); // получаем id текущий сделки
    wait(duration * 60 - 3); // вторая часть времени

    result = check_win_loose(current_id);

    // если возврат, то рекурсивно перезапуск
    if (result == 'Возврат') result = one_roll(bet, duration, trend);
    return result;
}

// ставка после выигрыша, так же изменяет шаг ставки
function bet_after_win () {
    switch (number_strategy)
    {
        case 1:
            if (step < step_replacement_trend) trend = change_trend(trend);
            step = 1;
            step_trend = 1;
            return start_bet;
            break;
        case 2:
            step--;
            if (step_trend < step_replacement_trend) trend = change_trend(trend);
            step_trend = 1;
            if (step < 1) step = 1;
            return bet_natanson(step, start_bet);
            break;
    }
}


// ставка после проигрыша, так же изменяет шаг ставки
function bet_after_loss (bet, percent) {
    step++;
    step_trend++;
    if (step_trend > 4) {
        step_trend = 1;
        trend = change_trend(trend);
    }
    switch (number_strategy)
    {
        case 1:
            return increasing_bet_of_martingale(bet, percent);
            break;
        case 2:
            return bet_natanson(step, start_bet);
            break;
    }
}

// выбор ставки по натансону (пока без процентов, в дальнейшем возможно изменю)
function bet_natanson(step, start_bet) {
    return step * start_bet;
}

// новая (повышенная) ставка, рассчитывается по мартингейл 4
function increasing_bet_of_martingale(bet, percent) {
    result = Math.ceil(bet * 2 + (bet * (koefic + 1 - percent / 100)))
    return result;
}

// ===============-------------=============
// вывод на дисплей аймакроса
// ===============-------------=============
function dsp(bet, trend) {
    balance = get_balance();

    current_profit = balance - start_balance;
    all_count_rolls = count_win + count_loose;
    win_procent = 100 / all_count_rolls * count_win;

    plus = (current_profit > 0) ? '+' : '';

    trn = (trend == 'up') ? '\u21C8' : '\u21CA';

    message = 'Баланс: ' + balance + ' (' + plus + current_profit.toFixed(2) + ')' +
            '\nИгр: ' + all_count_rolls + ' (+' + count_win + '/-' + count_loose + ')' +
            ', выигрыш: [ ' + win_procent.toFixed(1) + '% ]' +
            '\nСтавка: '+ bet + ' ( шаг ставки: ' + step + ' ), Ставим ' + trn + ' шаг: ' + step_trend +
            '\nМакс.шаг был: ' + max_step + ' , (объём ставок: '+ volume_bets +')';

    iimDisplay(message);
    save_session_file(message + '\n' + get_current_time() + '\n');
}

// поиск тикающего таймера (если его нет)
function timer_not_found() {
    // alert(window.document.getElementsByClassName("timer")[0].textContent);
    result = window.document.getElementsByClassName("timer").length;
    if (result > 0) {
        return false;
    } else {
        return true;
    }
}

// поиск надписи значения, что нет открытых сделок
function search_trade_transaction() {
    w = window.document;
    result = w.getElementsByClassName("no-active-deals").length;
    if (result > 0) {
        return true;
    } else {
        return false;
    }
}

// открыть сайт олимпа
function open_olymp_site() {
        // если страница закрыта (нет возможности найти элемент баланс), то открыть вкладку
    // и перейти на страницу freebitco.in
    if (window.document.getElementsByClassName("sum header-row__balance-sum ").length <= 0) {
        iimPlayCode('URL GOTO=https://olymptrade.com\nWAIT SECONDS=#DOWNLOADCOMPLETE#');
        // window.open("https://olymptrade.com/", "_blank");
        wait(15);
    } else {
        iimPlayCode('REFRESH\nWAIT SECONDS=#DOWNLOADCOMPLETE#');
        wait(3);
    }
}

// ========================================================================================
// ========================================================================================
// ========================================================================================

main();
// trading();  // сразу торги без предупреждений

// alert(get_latest_id());

function main() {
    update_log_file();
    hours = get_hours();
    if (hours < 8 || hours > 23) {
        alert('Для торговли не подходящее время.\nРекомендуется дождаться 8 утра.\n\nПрограмма будет остановлена!');
        return;
    } else {
        set_duration_transaction(start_duration); // устанавливаем длительность сделки
        wait(1);
        save_session_file('Старт сессии: ' + get_current_time() + '\n---------------------------\n');
        result = trading();
        if (result == 'ERROR') log('Какая-то ошибка! Завершаем работу (возможен слив на этом моменте).');
    }
}

// собственно функция торговли
function trading() {

    var percent_currency = get_percent_currency();

    if (percent_currency < 75) {
        result = confirm('Выбранная валютная пара имеет маленький процент прибыли\n    Всего ' + percent_currency + '%\nДля более-менее комфортной торговли с увеличением ставок\nрекомендуется выбрать валюту с процентом не менее 75-80%.\n\nВы уверены, что хотие запустить скрипт на текущей валютной паре?');
        if (result == false) {
            iimDisplay('Скрипт остановлен.');
            return;
        }
    }

    trend = get_start_trend();

    var bet = start_bet;

    txt = 'Стартовый баланс: ' + String(balance) + ', начальная ставка: ' + String(start_bet) + ', коэф.: ' + String(koefic);
    log(txt);

    while (balance < profit_balance) {
        result = one_roll(bet, duration, trend);

        if (result == 'ERROR') { return 'ERROR'; }

        percent_currency = get_percent_currency(); // всегда проверка на актуальность процента

        // выигрышная ставка
        if (result) {
            bet = bet_after_win();
            count_win++;
        }
        else { // проигрышная ставка
            bet = bet_after_loss(bet, percent_currency);
            count_loose++;
        }

        // (стоп-игра!) огранчение по ставке (слив)
        if (bet > loose_bet) {

            wait(2);
            balance = get_balance();
            current_profit = balance - start_balance;
            win_procent = 100 / all_count_rolls * count_win;

            txt = 'Ограничение по ставке! ;) ' + String(loose_bet) + ', Баланс: ' + String(balance) +
            ' (' + current_profit.toFixed(2) + '), макс. шаг: ' + max_step +
            ', Игр: ' + all_count_rolls + ' (+' + count_win + '/-' + count_loose + ')' +
            ', выигрыш: [ ' + win_procent.toFixed(1) + '% ]';

            txt_dsp = 'Ограничение по ставке! :-((\n' +
                        'Ставка ' + String(bet) + ' > ' + String(loose_bet) +'\n' +
                        'Баланс: ' + String(balance) +
                        '\nМаксимальный шаг: ' + String(max_step) + '\n';
            iimDisplay(txt_dsp);
            log(txt);
            return;
        }

        // слива полная :(
        if (balance < bet) {

            wait(2);
            balance = get_balance();
            current_profit = balance - start_balance;
            win_procent = 100 / all_count_rolls * count_win;

            txt = 'Слива! :-(( Баланс:' + String(balance) +
            ' (+' + current_profit.toFixed(2) + '), макс. шаг: ' + max_step +
            ', Игр: ' + all_count_rolls + ' (+' + count_win + '/-' + count_loose +
            '), выигрыш: [ ' + win_procent.toFixed(1) + '% ]';

            txt_dsp = 'Слива! :-((\nБаланс: ' + String(balance) +
                        '\nМаксимальный шаг: ' + max_step + '\n';
            iimDisplay(txt_dsp);
            log(txt);
            return;
        }

        if (max_step < step) max_step = step;
        duration = new_duration(step); // если нужно, то меняем длительность сделки
    }

    wait(2);

    balance = get_balance();
    all_count_rolls = count_win + count_loose;
    current_profit = balance - start_balance;
    win_procent = 100 / all_count_rolls * count_win;

    txt =   'ПРОФИТ!!! Баланс: ' + String(balance) +
            ' (+' + current_profit.toFixed(2) + '), макс. шаг: ' + max_step +
            ', Игр: ' + all_count_rolls + ' (+' + count_win + '/-' + count_loose +
            '), выигрыш: [ ' + win_procent.toFixed(1) + '% ]';

    txt_dsp = 'ПРОФИТ! +' + current_profit.toFixed(2) + ' \nБаланс: ' + String(balance) + '\nМаксимальный шаг: ' + max_step + '\n';
    iimDisplay(txt_dsp);
    log(txt);
}
