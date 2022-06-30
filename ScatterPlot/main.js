//Load Data
d3.csv('data/movies.csv').then(
    res => {
        console.log(res);
    }
)

//Data utilities
//遇到NA就設定為undefined, 要不然就維持原本的字串
const parseNA = string => (string === 'NA' ? undefined : string);
//日期處理
const parseDate = string => d3.timeParse('%Y-%m-%d')(string);

// + 轉換成數字
function type(d) {
    const date = parseDate(d.release_date);
    return {
        budget: +d.budget, //無空值就照打,d則表示全部資料
        genre: parseNA(d.genre),
        genres: JSON.parse(d.genres).map(d => d.name),
        //JSON: 將格式改為較為正式的array顯示; map(d=>d.name): 只取name,捨棄id,避免資料雜亂
        homepage: parseNA(d.homepage),
        id: +d.id,
        imdb_id: parseNA(d.imdb_id),
        original_language: parseNA(d.original_language),
        overview: parseNA(d.overview),
        popularity: +d.popularity,
        poster_path: parseNA(d.poster_path),
        production_countries: JSON.parse(d.production_countries),
        release_date: date, //上面有處理過了
        release_year: date.getFullYear(),
        revenue: +d.revenue,
        runtime: +d.runtime,
        tagline: parseNA(d.tagline),
        title: parseNA(d.title),
        vote_average: +d.vote_average,
        vote_count: +d.vote_count,
    }
}

//Data selection
function filterData(data) {
    return data.filter(
        d => {
            return (
                d.release_year > 1999 && d.release_year < 2010 &&
                d.revenue > 0 &&
                d.budget > 0 &&
                d.genre &&
                d.title
            );
        }
    );
}

function formatTicks(d) {
    return d3.format('~s')(d)
        .replace('M', 'mil')
        .replace('G',
            'bil')
        .replace('T', 'tri')
}

function prepareBarChartData(data) {
    console.log(data);
    const dataMap = d3.rollup(
        data,
        v => d3.sum(v, leaf => leaf.revenue), //將revenue加總
        d => d.genre //依電影分類groupby
    );
    //debugger;
    const dataArray = Array.from(dataMap, d => ({ genre: d[0], revenue: d[1] }));
    return dataArray;
}

function prepareScatterData(data) {
    return data.sort((a, b) => b.budget - a.budget)
        .filter((d, i) => i < 100);
}

function addLabel(axis, label, x, y) {
    /* axis 是呼叫者 - 哪一個軸 */
    axis.selectAll('.tick:last-of-type text')
        .clone()
        .text(label)
        .attr('x', x)
        .attr('y', y)
        .style('text-anchor', 'start')
        .style('font-weight', 'bold')
        .style('fill', '#555');
}

function setupCanvas(scatterData) {
    const svg_width = 500;
    const svg_height = 500;
    const chart_margin = { top: 80, right: 40, bottom: 40, left: 80 }; //上面跟左邊留比較多是因為要放標題
    const chart_width = svg_width - (chart_margin.left + chart_margin.right);
    const chart_height = svg_height - (chart_margin.top + chart_margin.bottom);

    const this_svg = d3.select('.scatter-plot-container').append('svg')
        .attr('width', svg_width).attr('height', svg_height).append('g')
        .attr('transform', `translate(${chart_margin.left},${chart_margin.top})`);

    //scale // d3的重頭戲~~
    const xExtent = d3.extent(scatterData, d => d.budget);
    const xScale = d3.scaleLinear().domain(xExtent).range([0, chart_width]);

    // //V1.d3.extent find the max & min in revenue
    // //range: 實際要放東西的地方; domain: 資料; 總和考量下得出間隔該有多少?
    // //V2.0 ~ max
    // const xMax = d3.max(scatterData, d => d.budget); //抓出最大值
    // //debugger;
    // //v2 : 0 -> max
    // const xScale_v2 = d3.scaleLinear().domain([0, xMax]).range([0, chart_width]);
    // //V3 : Short writing for v2
    // const xScale_v3 = d3.scaleLinear([0, xMax], [0, chart_width]);

    //垂直空間的分配 - 平均分布給各種類
    const yExtent = d3.extent(scatterData, d => d.revenue);
    const yScale = d3.scaleLinear().domain(yExtent).range([chart_width, 0]);

    //出現/更新/消失
    //Draw Scatters
    this_svg.selectAll('.scatter').data(scatterData).enter()
        .append('circle').attr('class', 'scatter')
        .attr('cx', d => xScale(d.budget)) //雖然是function但不用取名字,因為不會再見到他了
        .attr('cy', d => yScale(d.revenue))
        .attr('r', 3)
        .style('fill', 'dodgerblue')
        .style('fill-opacity', 0.5); //降低透明度,讓點比較明顯

    //Draw header
    const header = this_svg.append('g').attr('class', 'bar-header')
        .attr('transform', `translate(0,${-chart_margin.top / 2})`)
        .append('text');
    header.append('tspan').text('Budget vs. Revenue in $US');
    header.append('tspan').text('Top 100 films by budget, 2000-2009')
        .attr('x', 0).attr('y', 20).style('font-size', '0.8em').style('fill', '#555');

    //ticks 決定約略有幾個刻度(依數值狀況)
    const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat(formatTicks)
        .tickSizeInner(-chart_height)
        .tickSizeOuter(0);
    const xAxisDraw = this_svg.append('g').attr('class', 'x axis')
        .attr('transform', `translate(-10,${chart_height + 10})`)
        .call(xAxis)
        .call(addLabel, 'Budget', 25, 0);
    //拉開字與軸的距離
    xAxisDraw.selectAll('text').attr('dy', '2em');

    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(formatTicks)
        .tickSizeInner(-chart_height).tickSizeOuter(0);
    const yAxisDraw = this_svg.append('g').attr('class', 'y axis')
        .attr('transform', `translate(-10,10)`)
        .call(yAxis)
        .call(addLabel, 'Revenue', -30, -30);

    //拉開字與軸的距離
    yAxisDraw.selectAll('text').attr('dx', '-2em');

}

//Main
function ready(movies) {
    const moviesClean = filterData(movies);
    // console.log(moviesClean);
    // const barChartData = prepareBarChartData(moviesClean).sort(
    //     (a, b) => {
    //         return d3.descending(a.revenue, b.revenue); //descending大排到小
    //         //return b.revenue - a.revenue; //上面那句如果不用d3就是長這樣
    //     }
    // );
    const scatterData = prepareScatterData(moviesClean);
    console.log(scatterData);
    setupCanvas(scatterData);
}

//Load Data
d3.csv('data/movies.csv', type).then(
    res => {
        ready(res);
        // console.log(res);
    }
)