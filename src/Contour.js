import {ingest, Transform} from 'vega-dataflow';
import {inherits} from 'vega-util';
import {extent} from 'd3-array';
import {contours, contourDensity} from 'd3-contour';

var CONTOUR_PARAMS = ['values', 'size'];
var DENSITY_PARAMS = ['x', 'y', 'size', 'cellSize', 'bandwidth'];

/**
 * Generate contours based on kernel-density estimation of point data.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {Array<number>} params.size - The dimensions [width, height] over which to compute contours.
 *  If the values parameter is provided, this must be the dimensions of the input data.
 *  If density estimation is performed, this is the output view dimensions in pixels.
 * @param {Array<number>} [params.values] - An array of numeric values representing an
 *  width x height grid of values over which to compute contours. If unspecified, this
 *  transform will instead attempt to compute contours for the kernel density estimate
 *  using values drawn from data tuples in the input pulse.
 * @param {function(object): number} [params.x] - The pixel x-coordinate accessor for density estimation.
 * @param {function(object): number} [params.y] - The pixel y-coordinate accessor for density estimation.
 * @param {number} [params.cellSize] - Contour density calculation cell size.
 * @param {number} [params.bandwidth] - Kernel density estimation bandwidth.
 * @param {Array<number>} [params.thresholds] - Contour threshold array. If
 *   this parameter is set, the count and nice parameters will be ignored.
 * @param {number} [params.count] - The desired number of contours.
 * @param {boolean} [params.nice] - Boolean flag indicating if the contour
 *   threshold values should be automatically aligned to "nice"
 *   human-friendly values. Setting this flag may cause the number of
 *   thresholds to deviate from the specified count.
 */
export default function Contour(params) {
  Transform.call(this, null, params);
}

var prototype = inherits(Contour, Transform);

prototype.transform = function(_, pulse) {
  if (this.value && !pulse.changed() && !_.modified())
    return pulse.StopPropagation;

  var out = pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS),
      count = _.count || 10,
      contour, params, values;

  if (_.values) {
    contour = contours();
    params = CONTOUR_PARAMS;
    values = _.values;
  } else {
    contour = contourDensity();
    params = DENSITY_PARAMS;
    values = pulse.materialize(pulse.SOURCE).source;
  }

  // set threshold parameter
  contour.thresholds(_.thresholds || (_.nice ? count : quantize(count)));

  // set all other parameters
  params.forEach(function(param) {
    if (_[param] != null) contour[param](_[param]);
  });

  if (this.value) out.rem = this.value;
  this.value = out.source = out.add = contour(values).map(ingest);

  return out;
};

function quantize(k) {
  return function(values) {
    var ex = extent(values), x0 = ex[0], dx = ex[1] - x0,
        t = [], i = 1;
    for (; i<=k; ++i) t.push(x0 + dx * i / (k + 1));
    return t;
  };
}
