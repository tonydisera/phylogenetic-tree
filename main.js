/*

Author:  Tony Di Sera tonydisera@berkeley.edu

This viz is for W209.4 Fall 2019.  Much of the D3
code came from the following sources:

  The phylogenetic tree:
  https://observablehq.com/@mbostock/tree-of-life

  The gradient legend:
  https://bl.ocks.org/john-guerra/a75733ba5767813d4f31026d1d5e6244

I've added a barchart to the radial tree that shows the
percent of sequene the species shares with the Human
genome.
*/
let tooltip = null;
let width = 730
let outerRadius = 300
let innerRadius = 180
let marginTop = 100
let marginLeft = -70
let link = null
let linkExtension = null
let node = null
let phyloFileName      = "data/hg19.100way.commonNames.nh";
let similarityFileName = "data/species_multialign_info.csv";
let genomeInfoFileName = "data/eukaryotes.csv";
let speciesInfo = {}
let scientificNameToSpecies = {}
let barHeight = 18
let barWidth = 5
let barPadding = 4
let barHeightIsRatio = false;


var similarityColorScale = null;
var genomeSizeScale = null;
var genomeSizeMaxRadius = 7;
var genomeSizeMinRadius = 2;

let treeObject = null;
let showSimilarity = false;
let showGenomeSize = false;

$(document).ready(function() {

  var branchToggleButton = new ButtonStrip({
    id: 'the-toggle-button'
  });
  branchToggleButton.addButton('Hide', true, 'click', function(){
    updateBranch(false)
  });
  branchToggleButton.addButton('Show', false, 'click', function(){
     $('.collapse.show').removeClass("show");
    $('#collapseOne').addClass("show")
    updateBranch(true)
  });
  branchToggleButton.append('#branch-toggle-button');

  var similarityToggleButton = new ButtonStrip({
    id: 'the-similarity-toggle-button'
  });
  similarityToggleButton.addButton('Hide', true, 'click', function(){
    showSimilarity = false;
    drawTree(treeObject, getChartOptions())
  });
  similarityToggleButton.addButton('Show', false, 'click', function(){
    showSimilarity = true;
    $('.collapse.show').removeClass("show");
    $('#collapseTwo').addClass("show")
    drawTree(treeObject, getChartOptions())
  });
  similarityToggleButton.append('#similarity-toggle-button');


  var sizeToggleButton = new ButtonStrip({
    id: 'the-genome-size-toggle-button'
  });
  sizeToggleButton.addButton('Hide', true, 'click', function(){
    showGenomeSize = false;
    drawTree(treeObject, getChartOptions())
  });
  sizeToggleButton.addButton('Show', false, 'click', function(){
    showGenomeSize = true;
    $('.collapse.show').removeClass("show");
    $('#collapseThree').addClass("show")
    drawTree(treeObject, getChartOptions())
  });
  sizeToggleButton.append('#genome-size-toggle-button');


  promiseParseTreeData()
  .then(function(theTreeObject) {
    treeObject = theTreeObject
    drawTree(treeObject, getChartOptions);
  })



})

function onShowSimilarity() {
  $('#similarity-toggle-button .strip-button-1').addClass("active-strip-button");
  $('#similarity-toggle-button .strip-button-0').removeClass("active-strip-button");
  showSimilarity = true;
  drawTree(treeObject, getChartOptions())

}

function onShowGenomeSize() {
  $('#genome-size-toggle-button .strip-button-1').addClass("active-strip-button");
  $('#genome-size-toggle-button .strip-button-0').removeClass("active-strip-button");
  showGenomeSize = true;
  drawTree(treeObject, getChartOptions())

}

function getChartOptions() {
  return {
    'showSimilarity': showSimilarity,
    'showGenomeSize': showGenomeSize
  }
}

function promiseParseTreeData() {
  return new Promise(function(resolve, reject) {
    let treeObject = null;
    $.get(phyloFileName, function(data) {

      treeObject = Newick.parse(data)

      d3.csv(similarityFileName)
      .then(function(similarityData) {

        parseSimilarityData(similarityData);

        resolve(treeObject);

      })
      .catch(function(error) {
        alert("Unable to load file " + similarityFileName + ".")
      })



    }, 'text');

  })

}

function parseSimilarityData(similarityData) {
  similarityData.forEach(function(rec) {
    let speciesName = rec.species.replace(/ /g, "_");

    let genomeSize = (Math.round(+rec.size/1000000)*1000000);
    let genomeSizeMB = genomeSize / 10**6;
    genomeSizeMB = (Math.round(genomeSizeMB/100)*100);

    speciesInfo[speciesName] = {species:         speciesName,
                                ratioToHuman:    +rec.ratio_same_as_human,
                                scientific_name: rec.scientific_name,
                                genomeSize:       genomeSizeMB};

    scientificNameToSpecies[rec.scientific_name] = speciesName;
  })
}



function drawTree(treeObject, options) {

  // Define the div for the tooltip
  tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  const root = d3.hierarchy(treeObject, d => d.branchset)
      .sum(d => d.branchset ? 0 : 1)
      .sort((a, b) => (a.value - b.value) || d3.ascending(a.data.length, b.data.length));



  let cluster = d3.cluster()
    .size([360, innerRadius])
    .separation((a, b) => 1)


  cluster(root);

  console.log(root)

  setRadius(root, root.data.length = 0, innerRadius / maxLength(root));

  let container = d3.select(".phylo-tree");

  container.select("svg").remove();

  let svg = container.append("svg")
             .attr("width", width )
             .attr("height", width)
             .style("font", "10px sans-serif")
             .attr("viewBox", [-outerRadius, -outerRadius, width, width]);


  if (options.showGenomeSize) {
    let genomeSizes = d3.entries(speciesInfo).map(function(d){return d.value})
    genomeSizeScale = d3.scaleQuantize()
                         .domain(d3.extent(genomeSizes, function(d,i) {
                            return +d.genomeSize;
                         }))
                         .range(d3.ticks(genomeSizeMinRadius,genomeSizeMaxRadius, 5))
  }

  if (options.showSimilarity) {
    similarityColorScale = d3.scaleQuantize()
                             .domain([0,1])
                             .range(d3.quantize(d3.interpolateYlGnBu, 5))
  }

  if (options.showSimilarity) {
    drawSimilarityLegend(svg);
  }
  if (options.showGenomeSize) {
    drawGenomeSizeLegend(svg);
  }


  let group = svg.append("g")
                 .attr("transform", "translate(" + marginLeft + "," + marginTop + ")");

  linkExtension = group.append("g")
      .attr("class", "link-extensions")
      .selectAll("path")
      .data(root.links().filter(d => !d.target.children))
      .join("path")
      .each(function(d) { d.target.linkExtensionNode = this; })
      .attr("d", linkExtensionConstant);

  link = group.append("g")
      .attr("class", "links")
      .selectAll("path")
      .data(root.links())
      .join("path")
      .each(function(d) { d.target.linkNode = this; })
      .attr("d", linkConstant)


  node = group.append("g")
      .attr("class", "nodes")


  if (options.showSimilarity) {
    let similarity = node.selectAll("g.similarity")
        .data(root.leaves())
        .join("g")
        .attr("class", "similarity")
        .attr("transform", d => `rotate(${d.x - 90}) translate(${innerRadius + 4},0)${d.x < 180 ? "" : " rotate(180)"}`)

    similarity.append("rect")
              .attr("width", barWidth)
              .attr("height", d => {
                if (barHeightIsRatio) {
                  let ratio = speciesInfo[d.data.name].ratioToHuman;
                  if (ratio) {
                    return Math.max(barWidth, ratio * (barHeight-barPadding));
                  } else {
                    return 0;
                  }
                } else {
                  return barHeight - barPadding;
                }
              })
              .attr("x", -barPadding)
              .attr("y", d => {
                if (barHeightIsRatio) {
                  let ratio = speciesInfo[d.data.name].ratioToHuman;
                  if (d.x >= 180) {
                    return Math.min(-barWidth, ((-barHeight+barPadding) * ratio));
                  } else {
                    return 0;
                  }
                } else {
                  if (d.x >= 180) {
                    return -barHeight+barPadding;
                  } else {
                    return 0;
                  }
                }
              })
              .attr("fill", d => {
                let ratio = speciesInfo[d.data.name].ratioToHuman;
                return similarityColorScale(ratio);
              })
              .on("mouseover", mouseOverRatio(true))
              .on("mouseout", mouseOverRatio(false))

  } else {
    node.selectAll("g.similarity").remove()
  }

  let shiftOut = null;
  if (options.showSimilarity) {
    shiftOut = innerRadius + barHeight + barPadding  + genomeSizeMaxRadius/2 + 4;
  } else {
    shiftOut = innerRadius + genomeSizeMaxRadius/2 +  4;
  }
  if (options.showGenomeSize) {
    let genomeSize = node.selectAll("g.genome-size")
        .data(root.leaves())
        .join("g")
        .attr("class", "genome-size")
        .attr("transform", d => `rotate(${d.x - 90}) translate(${shiftOut},0)${d.x < 180 ? "" : " rotate(180)"}`)

    genomeSize.append("circle")
              .attr("r", d => {
                return genomeSizeScale(speciesInfo[d.data.name].genomeSize)
              })
              .attr("x", -barPadding)
              .attr("y", d => {
                return 0;
              })
              .on("mouseover", mouseOverGenomeSize(true))
              .on("mouseout", mouseOverGenomeSize(false))

  } else {
    node.selectAll("g.genome-size").remove()
  }


  shiftOut = null;
  if (options.showSimilarity) {
    shiftOut = innerRadius + barHeight + barPadding  + 4;
  } else {
    shiftOut = innerRadius + 4;
  }
  if (options.showGenomeSize) {
    shiftOut +=  (genomeSizeMaxRadius) + barPadding;
  }
  node.selectAll("text")
      .data(root.leaves())
      .join("text")
      .attr("class", function(d,i) {
        if (d.data.name == 'Human') {
          return 'emphasize-node';
        }
      })
      .attr("dy", ".31em")
      .attr("transform", d => `rotate(${d.x - 90}) translate(${shiftOut},0)${d.x < 180 ? "" : " rotate(180)"}`)
      .attr("text-anchor", d => d.x < 180 ? "start" : "end")
      .text(d => {
        return d.data.name.replace(/_/g, " ")
      })
      .on("mouseover", mouseovered(true))
      .on("mouseout", mouseovered(false));

  updateBranch(false)

}

function updateBranch(checked) {
  const t = d3.transition().duration(750);
  linkExtension.transition(t).attr("d", checked ? linkExtensionVariable : linkExtensionConstant);
  link.transition(t).attr("d", checked ? linkVariable : linkConstant);
}


function highlightExample(speciesNamesStr, emphasizeHuman=true) {
  let speciesNames = speciesNamesStr.split(",");
  d3.select(".phylo-tree")
     .selectAll("g.nodes text")
     .attr("class", function(d,i) {

        if (speciesNames.indexOf(d.data.name) >= 0) {
          return 'example-node';
        } else if (emphasizeHuman && d.data.name == 'Human') {
          return 'emphasize-node';
        } else {
          return 'deemphasize-node';
        }
     })

}

function resetChart() {

  d3.select(".phylo-tree")
     .selectAll("g.nodes text")
     .attr("class", function(d,i) {

        if (d.data.name == 'Human') {
          return 'emphasize-node';
        } else {
          return '';
        }
     })

}

function drawSimilarityLegend(svg) {


  svg.append("g")
    .attr("class", "legendSequential")
    .attr("transform", "translate(270, " + (-(width/2)+170) + ")");

  var legendSequential = d3.legendColor()
      .title("Sequence shared with Human")
      .titleWidth(110)
      .shapeWidth(20)
      .cells(10)
      .labelFormat(d3.format(".0%"))
      .orient("vertical")
      .scale(similarityColorScale)

  svg.select(".legendSequential")
    .call(legendSequential);
}

function drawGenomeSizeLegend(svg) {

  svg.append("g")
    .attr("class", "legendSize")
    .attr("transform", "translate(270, " + (-(width/2)+350) + ")");

  var prec     = d3.precisionPrefix(1e5, 1.3e6);
  var formatMB = d3.formatPrefix("." + prec, 1.3e6);

  var legendSize = d3.legendSize()
    .title("Genome size (in MB)")
    .titleWidth(80)
    .scale(genomeSizeScale)
    .shape('circle')
    .shapePadding(5)
    .cells(5)
    .labelFormat(d3.format(",.0f"))
    .labelOffset(5)
    .orient('vertical');

  svg.select(".legendSize")
     .call(legendSize);
}


// Set the radius of each node by recursively summing and scaling the distance from the root.
function setRadius(d, y0, k) {
  d.radius = (y0 += d.data.length) * k;
  if (d.children) d.children.forEach(d => setRadius(d, y0, k));
}

function maxLength(d) {
  return d.data.length + (d.children ? d3.max(d.children, maxLength) : 0);
}
function linkVariable(d) {
  return linkStep(d.source.x, d.source.radius, d.target.x, d.target.radius);
}
function linkConstant(d) {
  return linkStep(d.source.x, d.source.y, d.target.x, d.target.y);
}
function linkExtensionVariable(d) {
  return linkStep(d.target.x, d.target.radius, d.target.x, innerRadius);
}
function linkExtensionConstant(d) {
  return linkStep(d.target.x, d.target.y, d.target.x, innerRadius);
}
function linkStep(startAngle, startRadius, endAngle, endRadius) {
  const c0 = Math.cos(startAngle = (startAngle - 90) / 180 * Math.PI);
  const s0 = Math.sin(startAngle);
  const c1 = Math.cos(endAngle = (endAngle - 90) / 180 * Math.PI);
  const s1 = Math.sin(endAngle);
  return "M" + startRadius * c0 + "," + startRadius * s0
      + (endAngle === startAngle ? "" : "A" + startRadius + "," + startRadius + " 0 0 " + (endAngle > startAngle ? 1 : 0) + " " + startRadius * c1 + "," + startRadius * s1)
      + "L" + endRadius * c1 + "," + endRadius * s1;
}
function mouseOverRatio(active) {
  return function(d) {
    if (active) {
      let ratio = speciesInfo[d.data.name].ratioToHuman;
      let pct = Math.round(ratio * 100,0);
      tooltip.transition()
          .duration(200)
          .style("opacity", .9);
      tooltip .html(d.data.name.replace(/_/g, " ")
                    + " shares "
                    + pct + "%  with Human")
          .style("left", (d3.event.pageX) + "px")
          .style("top", (d3.event.pageY - 44) + "px");

    } else {
      tooltip.transition()
          .duration(500)
          .style("opacity", 0);

    }
  }
}
function mouseOverGenomeSize(active) {
  return function(d) {
    if (active) {
      let genomeSize = speciesInfo[d.data.name].genomeSize;
      tooltip.transition()
          .duration(200)
          .style("opacity", .9);
      tooltip .html(d.data.name.replace(/_/g, " ")
                    + " genome size: "
                    + genomeSize + " MB")
          .style("left", (d3.event.pageX) + "px")
          .style("top", (d3.event.pageY - 44) + "px");

    } else {
      tooltip.transition()
          .duration(500)
          .style("opacity", 0);

    }
  }
}
function mouseovered(active) {
    return function(d) {

      d3.select(this).classed("label--active", active);
      d3.select(d.linkExtensionNode).classed("link-extension--active", active).raise();
      do d3.select(d.linkNode).classed("link--active", active).raise();
      while (d = d.parent);
    };
  }